from __future__ import annotations

import base64
import io
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from flask import Blueprint, jsonify, request
from PIL import Image, UnidentifiedImageError
from app.core.openai_client import get_openai_client, get_openai_model

space_detection_blueprint = Blueprint("space_detection", __name__)

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
_DEFAULT_CONFIDENCE = 0.25
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_MODEL_PATH = Path(__file__).resolve().parents[2] / "space_detection" / "best.pt"


@lru_cache(maxsize=1)
def _get_model() -> Any:
    if not _MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found at {_MODEL_PATH}")

    # Import lazily so the whole backend can boot even if CV deps are unavailable.
    from ultralytics import YOLO

    return YOLO(str(_MODEL_PATH))


def _get_planogram_tools():
    from space_detection.planogram_analysis import (
        analyze_shelf_image,
        load_planogram_for_scene,
        resolve_dataset_root,
    )

    return analyze_shelf_image, load_planogram_for_scene, resolve_dataset_root


def _parse_confidence(raw_value: str | None) -> float:
    if raw_value is None or raw_value == "":
        return _DEFAULT_CONFIDENCE

    try:
        confidence = float(raw_value)
    except ValueError as exc:
        raise ValueError("`conf` must be a number between 0 and 1.") from exc

    if confidence <= 0 or confidence > 1:
        raise ValueError("`conf` must be greater than 0 and less than or equal to 1.")

    return confidence


def _encode_plot_to_data_url(plot_bgr) -> str:
    # Ultralytics returns BGR ndarray; convert to RGB before encoding.
    rgb_plot = plot_bgr[:, :, ::-1]
    image = Image.fromarray(rgb_plot)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def _encode_upload_to_data_url(image_bytes: bytes, extension: str) -> str:
    mime_by_ext = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    }
    mime_type = mime_by_ext.get(extension, "image/jpeg")
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    if not raw_text:
        return {}

    stripped = raw_text.strip()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", stripped)
    if not match:
        return {}

    try:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        return {}

    return {}


def _extract_response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output_items = getattr(response, "output", None)
    if not isinstance(output_items, list):
        return ""

    text_chunks: list[str] = []
    for item in output_items:
        contents = getattr(item, "content", None)
        if not isinstance(contents, list):
            continue
        for content_item in contents:
            content_type = getattr(content_item, "type", "")
            text_value = getattr(content_item, "text", "")
            if content_type in {"output_text", "text"} and isinstance(text_value, str):
                text_chunks.append(text_value)

    return "\n".join(chunk for chunk in text_chunks if chunk).strip()


def _get_candidate_models(primary_model: str) -> list[str]:
    candidates: list[str] = []
    for model_name in [primary_model, "gpt-4o", "gpt-4o-mini"]:
        if model_name and model_name not in candidates:
            candidates.append(model_name)
    return candidates


def _request_missing_objects(
    client: Any,
    instruction: str,
    image_data_url: str,
    primary_model: str,
) -> tuple[str, str]:
    errors: list[str] = []

    for candidate_model in _get_candidate_models(primary_model):
        try:
            response = client.responses.create(
                model=candidate_model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": instruction},
                            {"type": "input_image", "image_url": image_data_url},
                        ],
                    }
                ],
                temperature=0,
            )
            text = _extract_response_text(response)
            if text:
                return text, candidate_model
        except Exception as error:  # noqa: BLE001
            errors.append(f"responses:{candidate_model}:{error.__class__.__name__}")

        try:
            completion = client.chat.completions.create(
                model=candidate_model,
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a retail shelf-audit assistant. Only return JSON. "
                            "Do not include markdown fences."
                        ),
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": instruction},
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                        ],
                    },
                ],
            )
            text = completion.choices[0].message.content or ""
            if text:
                return text, candidate_model
        except Exception as error:  # noqa: BLE001
            errors.append(f"chat:{candidate_model}:{error.__class__.__name__}")

    raise RuntimeError(
        "No compatible vision request path succeeded. "
        f"Attempts: {', '.join(errors[:6])}"
    )


def _normalize_label(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _identify_missing_with_yolo(image_bytes: bytes, expected_objects: list[str]) -> dict[str, Any]:
    input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model = _get_model()
    prediction = model.predict(source=input_image, conf=_DEFAULT_CONFIDENCE, verbose=False)[0]

    present_raw: list[str] = []
    present_normalized: set[str] = set()

    for box in prediction.boxes:
        class_id = int(box.cls.item())
        class_name = str(prediction.names.get(class_id, class_id))
        present_raw.append(class_name)
        present_normalized.add(_normalize_label(class_name))

    unique_present = sorted(set(present_raw), key=lambda x: x.lower())

    missing = []
    uncertain = []
    for expected in expected_objects:
        normalized_expected = _normalize_label(expected)
        if normalized_expected in present_normalized:
            continue
        if any(normalized_expected in label or label in normalized_expected for label in present_normalized):
            uncertain.append(expected)
        else:
            missing.append(expected)

    width, height = input_image.size
    return {
        "image": {"width": width, "height": height},
        "missing_objects": missing,
        "present_objects": unique_present,
        "uncertain_objects": uncertain,
        "notes": (
            "Fallback result generated from YOLO labels because vision LLM request "
            "was not accepted by the configured upstream API."
        ),
    }


@space_detection_blueprint.route("/detect", methods=["POST", "OPTIONS"])
@space_detection_blueprint.route("/detect/", methods=["POST", "OPTIONS"])
def detect_empty_space():
    if request.method == "OPTIONS":
        return "", 204

    if "image" not in request.files:
        return jsonify({"message": "No image file provided. Use form field `image`."}), 400

    image_file = request.files["image"]
    if not image_file or not image_file.filename:
        return jsonify({"message": "Image filename is missing."}), 400

    extension = Path(image_file.filename).suffix.lower()
    if extension and extension not in _ALLOWED_EXTENSIONS:
        return (
            jsonify({
                "message": "Unsupported file type. Use JPG, JPEG, PNG, WEBP, or BMP.",
            }),
            400,
        )

    image_bytes = image_file.read()
    if not image_bytes:
        return jsonify({"message": "Uploaded file is empty."}), 400

    if len(image_bytes) > _MAX_UPLOAD_BYTES:
        return jsonify({"message": "Image is too large. Maximum size is 10MB."}), 413

    try:
        confidence = _parse_confidence(request.form.get("conf"))
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    try:
        input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except UnidentifiedImageError:
        return jsonify({"message": "Invalid image file."}), 400

    try:
        model = _get_model()
        prediction = model.predict(source=input_image, conf=confidence, verbose=False)[0]
    except FileNotFoundError as error:
        return jsonify({"message": str(error)}), 500
    except (ImportError, OSError) as error:
        return jsonify({"message": f"Space detection dependencies are unavailable: {error}"}), 503
    except Exception as error:  # noqa: BLE001
        return jsonify({"message": f"Prediction failed: {error.__class__.__name__}"}), 500

    detections = []
    total_empty_area = 0.0

    for box in prediction.boxes:
        x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
        width = max(x2 - x1, 0.0)
        height = max(y2 - y1, 0.0)
        area = width * height
        total_empty_area += area

        class_id = int(box.cls.item())
        class_name = prediction.names.get(class_id, str(class_id))

        detections.append(
            {
                "label": class_name,
                "confidence": round(float(box.conf.item()), 4),
                "bbox": {
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2),
                    "width": round(width, 2),
                    "height": round(height, 2),
                    "area": round(area, 2),
                },
            }
        )

    image_width, image_height = input_image.size
    image_area = max(float(image_width * image_height), 1.0)
    empty_area_percent = round((total_empty_area / image_area) * 100, 2)

    annotated_image = _encode_plot_to_data_url(prediction.plot())

    return jsonify(
        {
            "message": "Detection complete",
            "model": _MODEL_PATH.name,
            "confidence_threshold": confidence,
            "image": {
                "width": image_width,
                "height": image_height,
            },
            "summary": {
                "empty_space_count": len(detections),
                "estimated_empty_area_pixels": round(total_empty_area, 2),
                "estimated_empty_area_percent": empty_area_percent,
            },
            "detections": detections,
            "annotated_image": annotated_image,
        }
    )


@space_detection_blueprint.route("/identify-missing", methods=["POST", "OPTIONS"])
@space_detection_blueprint.route("/identify-missing/", methods=["POST", "OPTIONS"])
def identify_missing_objects():
    if request.method == "OPTIONS":
        return "", 204

    if "image" not in request.files:
        return jsonify({"message": "No image file provided. Use form field `image`."}), 400

    image_file = request.files["image"]
    if not image_file or not image_file.filename:
        return jsonify({"message": "Image filename is missing."}), 400

    extension = Path(image_file.filename).suffix.lower()
    if extension and extension not in _ALLOWED_EXTENSIONS:
        return (
            jsonify({
                "message": "Unsupported file type. Use JPG, JPEG, PNG, WEBP, or BMP.",
            }),
            400,
        )

    image_bytes = image_file.read()
    if not image_bytes:
        return jsonify({"message": "Uploaded file is empty."}), 400

    if len(image_bytes) > _MAX_UPLOAD_BYTES:
        return jsonify({"message": "Image is too large. Maximum size is 10MB."}), 413

    try:
        input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except UnidentifiedImageError:
        return jsonify({"message": "Invalid image file."}), 400

    expected_raw = request.form.get("expected_objects", "").strip()
    expected_objects = [item.strip() for item in expected_raw.split(",") if item.strip()]

    instruction = (
        "Identify product objects that appear missing or out-of-stock from this shelf image. "
        "Respond as strict JSON with keys: missing_objects (array of strings), "
        "present_objects (array of strings), uncertain_objects (array of strings), "
        "and notes (short string)."
    )
    if expected_objects:
        instruction += f" Prioritize checking these expected products: {', '.join(expected_objects)}."

    used_model = ""
    fallback_result: dict[str, Any] | None = None

    try:
        client = get_openai_client()
        primary_model = get_openai_model()
        image_data_url = _encode_upload_to_data_url(image_bytes=image_bytes, extension=extension)

        content, used_model = _request_missing_objects(
            client=client,
            instruction=instruction,
            image_data_url=image_data_url,
            primary_model=primary_model,
        )
        llm_result = _extract_json_object(content)
    except ValueError as error:
        return jsonify({"message": str(error)}), 503
    except Exception:
        llm_result = {}
        try:
            fallback_result = _identify_missing_with_yolo(image_bytes=image_bytes, expected_objects=expected_objects)
            used_model = _MODEL_PATH.name
        except Exception as fallback_error:  # noqa: BLE001
            return jsonify({"message": f"Missing-object identification failed: {fallback_error}"}), 500

    missing_objects = llm_result.get("missing_objects")
    if not isinstance(missing_objects, list):
        missing_objects = []

    present_objects = llm_result.get("present_objects")
    if not isinstance(present_objects, list):
        present_objects = []

    uncertain_objects = llm_result.get("uncertain_objects")
    if not isinstance(uncertain_objects, list):
        uncertain_objects = []

    notes = llm_result.get("notes")
    if not isinstance(notes, str):
        notes = ""

    image_width, image_height = input_image.size

    if fallback_result is not None:
        missing_objects = fallback_result["missing_objects"]
        present_objects = fallback_result["present_objects"]
        uncertain_objects = fallback_result["uncertain_objects"]
        notes = fallback_result["notes"]
        image_width = fallback_result["image"]["width"]
        image_height = fallback_result["image"]["height"]

    if not used_model:
        used_model = get_openai_model()

    return jsonify(
        {
            "message": "Missing-object identification complete",
            "model": used_model,
            "image": {
                "width": image_width,
                "height": image_height,
            },
            "expected_objects": expected_objects,
            "missing_objects": missing_objects,
            "present_objects": present_objects,
            "uncertain_objects": uncertain_objects,
            "notes": notes,
        }
    )


@space_detection_blueprint.route("/analyze-planogram", methods=["POST", "OPTIONS"])
@space_detection_blueprint.route("/analyze-planogram/", methods=["POST", "OPTIONS"])
def analyze_against_planogram():
    if request.method == "OPTIONS":
        return "", 204

    if "image" not in request.files:
        return jsonify({"message": "No image file provided. Use form field `image`."}), 400

    image_file = request.files["image"]
    if not image_file or not image_file.filename:
        return jsonify({"message": "Image filename is missing."}), 400

    extension = Path(image_file.filename).suffix.lower()
    if extension and extension not in _ALLOWED_EXTENSIONS:
        return (
            jsonify({
                "message": "Unsupported file type. Use JPG, JPEG, PNG, WEBP, or BMP.",
            }),
            400,
        )

    image_bytes = image_file.read()
    if not image_bytes:
        return jsonify({"message": "Uploaded file is empty."}), 400

    if len(image_bytes) > _MAX_UPLOAD_BYTES:
        return jsonify({"message": "Image is too large. Maximum size is 10MB."}), 413

    try:
        input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except UnidentifiedImageError:
        return jsonify({"message": "Invalid image file."}), 400

    scene_id = request.form.get("scene_id", "").strip()
    dataset_root_raw = request.form.get("dataset_root", "").strip() or None
    planogram_json_raw = request.form.get("planogram_json", "").strip()

    if not scene_id and not planogram_json_raw and "planogram" not in request.files:
        return (
            jsonify({
                "message": (
                    "Provide either `scene_id` for a generated synthetic planogram, "
                    "`planogram_json`, or an uploaded `planogram` JSON file."
                ),
            }),
            400,
        )

    try:
        analyze_shelf_image, load_planogram_for_scene, resolve_dataset_root = _get_planogram_tools()
        resolved_dataset_root = resolve_dataset_root(dataset_root_raw)

        if planogram_json_raw:
            planogram = json.loads(planogram_json_raw)
        elif "planogram" in request.files:
            planogram_file = request.files["planogram"]
            planogram_bytes = planogram_file.read()
            if not planogram_bytes:
                return jsonify({"message": "Uploaded planogram file is empty."}), 400
            planogram = json.loads(planogram_bytes.decode("utf-8"))
        else:
            planogram = load_planogram_for_scene(scene_id=scene_id, dataset_root=resolved_dataset_root)

        if not isinstance(planogram, dict):
            return jsonify({"message": "Planogram payload must decode to a JSON object."}), 400

        analysis = analyze_shelf_image(
            image=input_image,
            planogram=planogram,
            dataset_root=resolved_dataset_root,
        )
    except json.JSONDecodeError:
        return jsonify({"message": "Planogram JSON could not be parsed."}), 400
    except FileNotFoundError as error:
        return jsonify({"message": str(error)}), 404
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    except (ImportError, OSError) as error:
        return jsonify({"message": f"Planogram analysis dependencies are unavailable: {error}"}), 503
    except Exception as error:  # noqa: BLE001
        return jsonify({"message": f"Planogram analysis failed: {error.__class__.__name__}: {error}"}), 500

    return jsonify(
        {
            "message": "Planogram analysis complete",
            **analysis,
        }
    )

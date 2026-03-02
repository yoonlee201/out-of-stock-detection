from __future__ import annotations

import base64
import io
from functools import lru_cache
from pathlib import Path
from typing import Any

from flask import Blueprint, jsonify, request
from PIL import Image, UnidentifiedImageError

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

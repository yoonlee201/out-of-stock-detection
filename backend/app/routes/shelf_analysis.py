import base64
import os
import sys
import tempfile
import traceback
from io import BytesIO
from pathlib import Path

from flask import Blueprint, jsonify, request
from PIL import Image


def _find_project_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "shelf_analyzer").is_dir():
            return parent
    raise RuntimeError("shelf_analyzer directory not found in any parent of this file")

_project_root = _find_project_root()
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))


shelf_analysis_blueprint = Blueprint("shelf_analysis", __name__)


def _get_shelf_tools():
    from shelf_analyzer.compliance_reporter import build_compliance_report
    from shelf_analyzer.infer import analyze_shelf_debug
    from shelf_analyzer.visualize import draw_annotations

    return (
        analyze_shelf_debug,
        draw_annotations,
        build_compliance_report,
    )


def _build_summary(detections: list[dict]) -> dict:
    product_count = sum(1 for item in detections if item.get("type") == "product")
    empty_space_count = sum(1 for item in detections if item.get("type") == "empty_space")
    correct_count = sum(1 for item in detections if item.get("audit_status") == "correct")
    missing_count = sum(1 for item in detections if item.get("audit_status") == "missing")
    misplaced_count = sum(1 for item in detections if item.get("audit_status") == "misplaced")
    unverified_count = sum(1 for item in detections if item.get("audit_status") == "unverified")
    unique_skus = {
        (
            (item.get("sku") or {}).get("brand", ""),
            (item.get("sku") or {}).get("product_name", ""),
            (item.get("sku") or {}).get("variant", ""),
            (item.get("sku") or {}).get("size", ""),
        )
        for item in detections
        if item.get("type") == "product"
    }

    return {
        "product_count": product_count,
        "empty_space_count": empty_space_count,
        "unique_sku_count": len(unique_skus),
        "correct_count": correct_count,
        "missing_count": missing_count,
        "misplaced_count": misplaced_count,
        "unverified_count": unverified_count,
    }


def _attach_issue_markers(detections: list[dict]) -> list[dict]:
    missing_index = 1
    misplaced_index = 1
    enriched: list[dict] = []

    for detection in detections:
        enriched_detection = dict(detection)
        status = enriched_detection.get("audit_status")

        if status == "missing":
            enriched_detection["issue_marker"] = f"M{missing_index}"
            missing_index += 1
        elif status == "misplaced":
            enriched_detection["issue_marker"] = f"W{misplaced_index}"
            misplaced_index += 1
        else:
            enriched_detection["issue_marker"] = None

        enriched.append(enriched_detection)

    return enriched


def _split_compliance_notes(detections: list[dict]) -> tuple[list[dict], list[str]]:
    visible_detections: list[dict] = []
    compliance_notes: list[str] = []

    for detection in detections:
        if detection.get("type") == "compliance_note":
            note = str(detection.get("note") or "").strip()
            if note:
                compliance_notes.append(note)
            continue

        visible_detections.append(detection)

    return visible_detections, compliance_notes


@shelf_analysis_blueprint.route("/analyze", methods=["POST", "OPTIONS"])
@shelf_analysis_blueprint.route("/analyze/", methods=["POST", "OPTIONS"])
def analyze_shelf():
    if request.method == "OPTIONS":
        return ("", 204)

    uploaded_file = request.files.get("image")
    if uploaded_file is None:
        return jsonify({"message": "Upload an image file under the `image` field."}), 400

    if not uploaded_file.filename:
        return jsonify({"message": "Please choose an image file."}), 400

    if not (uploaded_file.mimetype or "").startswith("image/"):
        return jsonify({"message": "Only image uploads are allowed."}), 400

    uploaded_file = request.files["image"]
    if not uploaded_file.filename:
        return jsonify({"message": "Please choose an image file."}), 400

    temp_path = None
    try:
        (
            analyze_shelf_debug,
            draw_annotations,
            build_compliance_report,
        ) = _get_shelf_tools()

        image = Image.open(uploaded_file.stream).convert("RGB")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_path = temp_file.name
        image.save(temp_path, format="JPEG", quality=95)

        debug_bundle = analyze_shelf_debug(temp_path)
        raw_detections = debug_bundle["audit_results"]
        visible_detections, compliance_notes = _split_compliance_notes(raw_detections)
        detections = _attach_issue_markers(visible_detections)
        compliance_report = build_compliance_report(raw_detections)
        processed_image_path = debug_bundle["processed_image_path"]
        processed_image = Image.open(processed_image_path).convert("RGB")
        annotated_image = draw_annotations(processed_image, detections)

        buffer = BytesIO()
        annotated_image.save(buffer, format="PNG")
        encoded_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return jsonify(
            {
                "message": "Shelf analysis completed.",
                "summary": _build_summary(detections),
                "compliance_report": compliance_report,
                "detections": detections,
                "compliance_notes": compliance_notes,
                "annotated_image": f"data:image/png;base64,{encoded_image}",
            }
        ), 200
    except Exception as error:
        traceback.print_exc()
        return jsonify({"message": f"Shelf analysis failed: {error}"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

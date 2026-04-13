import base64
import os
import sys
import tempfile
import traceback
from io import BytesIO
from pathlib import Path

from flask import Blueprint, jsonify, request
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


shelf_analysis_blueprint = Blueprint("shelf_analysis", __name__)


def _get_shelf_tools():
    from shelf_analyzer.infer import analyze_shelf_image
    from shelf_analyzer.visualize import draw_annotations

    return analyze_shelf_image, draw_annotations


def _build_summary(detections: list[dict]) -> dict:
    product_count = sum(1 for item in detections if item.get("type") == "product")
    empty_space_count = sum(1 for item in detections if item.get("type") == "empty_space")
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
    }


@shelf_analysis_blueprint.route("/analyze", methods=["POST", "OPTIONS"])
@shelf_analysis_blueprint.route("/analyze/", methods=["POST", "OPTIONS"])
def analyze_shelf():
    if request.method == "OPTIONS":
        return ("", 204)

    if "image" not in request.files:
        return jsonify({"message": "Upload an image file under the `image` field."}), 400

    uploaded_file = request.files["image"]
    if not uploaded_file.filename:
        return jsonify({"message": "Please choose an image file."}), 400

    temp_path = None
    try:
        analyze_shelf_image, draw_annotations = _get_shelf_tools()

        image = Image.open(uploaded_file.stream).convert("RGB")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_path = temp_file.name
        image.save(temp_path, format="JPEG", quality=95)

        detections = analyze_shelf_image(temp_path)
        annotated_image = draw_annotations(image, detections)

        buffer = BytesIO()
        annotated_image.save(buffer, format="PNG")
        encoded_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return jsonify(
            {
                "message": "Shelf analysis completed.",
                "summary": _build_summary(detections),
                "detections": detections,
                "annotated_image": f"data:image/png;base64,{encoded_image}",
            }
        ), 200
    except Exception as error:
        traceback.print_exc()
        return jsonify({"message": f"Shelf analysis failed: {error}"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

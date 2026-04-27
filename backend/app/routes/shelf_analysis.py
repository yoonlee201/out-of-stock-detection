import base64
import json
import os
import sys
import tempfile
import traceback
from io import BytesIO
from pathlib import Path

from flask import Blueprint, jsonify, request
from PIL import Image

from app.core.db import db
from app.models import ShelfAnalysisLog
from app.services.alert_services import send_out_of_stock_alerts
from app.util.auth import _get_current_user


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

        payload = {
            "message": "Shelf analysis completed.",
            "summary": _build_summary(detections),
            "compliance_report": compliance_report,
            "detections": detections,
            "compliance_notes": compliance_notes,
            "annotated_image": f"data:image/png;base64,{encoded_image}",
        }

        # Persist result — best-effort, never blocks the response
        log_id = None
        try:
            current_user = _get_current_user()
            log = ShelfAnalysisLog(
                user_id=current_user.user_id if current_user else None,
                file_name=uploaded_file.filename or "unknown",
                result_json=json.dumps(payload),
            )
            db.session.add(log)
            db.session.commit()
            log_id = log.id
        except Exception:
            db.session.rollback()
            traceback.print_exc()

        # Trigger alerts when the analysis found missing or misplaced items
        issue_detections = [
            d for d in detections
            if d.get("audit_status") in ("missing", "misplaced")
        ]
        if issue_detections:
            try:
                send_out_of_stock_alerts(issue_detections, shelf_analysis_log_id=log_id)
            except Exception:
                db.session.rollback()
                traceback.print_exc()  # surface alert failures in logs

        return jsonify(payload), 200
    except Exception as error:
        traceback.print_exc()
        return jsonify({"message": f"Shelf analysis failed: {error}"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@shelf_analysis_blueprint.route("/history", methods=["GET"])
def get_analysis_history():
    """Return the most recent 50 analysis logs (newest first)."""
    limit = min(int(request.args.get("limit", 50)), 200)
    logs = (
        ShelfAnalysisLog.query
        .order_by(ShelfAnalysisLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([
        {
            "id": log.id,
            "file_name": log.file_name,
            "created_at": log.created_at.isoformat(),
            "result": json.loads(log.result_json),
        }
        for log in logs
    ]), 200

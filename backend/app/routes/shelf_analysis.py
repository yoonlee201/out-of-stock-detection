import base64
import json
import os
import sys
import tempfile
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from PIL import Image

from app.core.db import db
from app.models import ShelfAnalysisLog
from app.services.alert_services import send_out_of_stock_alerts, update_shelf_status_from_detections
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

_MAX_CONCURRENT = 3
_semaphore = threading.Semaphore(_MAX_CONCURRENT)
_executor = ThreadPoolExecutor(max_workers=_MAX_CONCURRENT + 8)
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def _cleanup_old_jobs() -> None:
    cutoff = time.time() - 3600
    stale = [jid for jid, j in _jobs.items() if j["submitted_at"] < cutoff]
    for jid in stale:
        del _jobs[jid]


def _get_queue_position(job_id: str) -> int | None:
    job = _jobs.get(job_id)
    if not job or job["status"] != "queued":
        return None
    my_time = job["submitted_at"]
    return 1 + sum(
        1 for jid, j in _jobs.items()
        if jid != job_id and j["status"] == "queued" and j["submitted_at"] < my_time
    )


def _get_shelf_tools():
    from shelf_analyzer.compliance_reporter import build_compliance_report
    from shelf_analyzer.infer import analyze_shelf_debug
    from shelf_analyzer.visualize import draw_annotations

    return analyze_shelf_debug, draw_annotations, build_compliance_report


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


def _process_job(job_id: str, temp_path: str, file_name: str, user_id, app) -> None:
    _semaphore.acquire()
    try:
        with _jobs_lock:
            _jobs[job_id]["status"] = "running"
            _jobs[job_id]["started_at"] = time.time()

        def on_progress(progress: int, eta_seconds: float | None = None) -> None:
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]["progress"] = progress
                    _jobs[job_id]["eta_seconds"] = eta_seconds

        analyze_shelf_debug, draw_annotations, build_compliance_report = _get_shelf_tools()

        debug_bundle = analyze_shelf_debug(temp_path, progress_callback=on_progress)
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
        on_progress(99)

        payload = {
            "message": "Shelf analysis completed.",
            "summary": _build_summary(detections),
            "compliance_report": compliance_report,
            "detections": detections,
            "compliance_notes": compliance_notes,
            "annotated_image": f"data:image/png;base64,{encoded_image}",
        }

        log_id = None
        with app.app_context():
            try:
                log = ShelfAnalysisLog(
                    user_id=user_id,
                    file_name=file_name,
                    result_json=json.dumps(payload),
                )
                db.session.add(log)
                db.session.commit()
                log_id = log.id
            except Exception:
                db.session.rollback()
                traceback.print_exc()

            try:
                update_shelf_status_from_detections(detections)
            except Exception:
                db.session.rollback()
                traceback.print_exc()

            issue_detections = [d for d in detections if d.get("audit_status") in ("missing", "misplaced")]
            if issue_detections:
                try:
                    send_out_of_stock_alerts(issue_detections, shelf_analysis_log_id=log_id)
                except Exception:
                    db.session.rollback()
                    traceback.print_exc()

        with _jobs_lock:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["progress"] = 100
            _jobs[job_id]["eta_seconds"] = None
            _jobs[job_id]["result"] = payload

    except Exception as error:
        traceback.print_exc()
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = str(error)
    finally:
        _semaphore.release()
        if os.path.exists(temp_path):
            os.remove(temp_path)


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

    file_name = uploaded_file.filename

    try:
        image = Image.open(uploaded_file.stream).convert("RGB")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_path = temp_file.name
        image.save(temp_path, format="JPEG", quality=95)
    except Exception as error:
        return jsonify({"message": f"Failed to read image: {error}"}), 400

    try:
        current_user = _get_current_user()
        user_id = current_user.user_id if current_user else None
    except Exception:
        user_id = None

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _cleanup_old_jobs()
        _jobs[job_id] = {
            "status": "queued",
            "progress": 0,
            "eta_seconds": None,
            "result": None,
            "error": None,
            "file_name": file_name,
            "submitted_at": time.time(),
            "started_at": None,
        }

    app = current_app._get_current_object()
    _executor.submit(_process_job, job_id, temp_path, file_name, user_id, app)

    with _jobs_lock:
        queue_position = _get_queue_position(job_id)

    return jsonify({"job_id": job_id, "queue_position": queue_position}), 202


@shelf_analysis_blueprint.route("/job/<job_id>", methods=["GET"])
def get_job(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return jsonify({"message": "Job not found."}), 404

        queue_position = _get_queue_position(job_id) if job["status"] == "queued" else None

        return jsonify({
            "status": job["status"],
            "progress": job["progress"],
            "eta_seconds": job["eta_seconds"],
            "queue_position": queue_position,
            "result": job["result"],
            "error": job.get("error"),
        }), 200


@shelf_analysis_blueprint.route("/", methods=["GET"])
@shelf_analysis_blueprint.route("", methods=["GET"])
def get_analysis_history():
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

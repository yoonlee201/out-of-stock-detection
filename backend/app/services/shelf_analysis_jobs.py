from __future__ import annotations

import base64
import os
import tempfile
import traceback
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from PIL import Image

from app.core.db import db
from app.models import ShelfAnalysisJob


JOB_STATUS_QUEUED = "queued"
JOB_STATUS_PROCESSING = "processing"
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
FINAL_JOB_STATUSES = {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED}


def _get_shelf_tools():
    from shelf_analyzer.compliance_reporter import build_compliance_report
    from shelf_analyzer.infer import analyze_shelf_debug
    from shelf_analyzer.visualize import draw_annotations

    return (
        analyze_shelf_debug,
        draw_annotations,
        build_compliance_report,
    )


def _to_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _isoformat(dt: datetime | None) -> str | None:
    normalized = _to_utc(dt)
    return normalized.isoformat() if normalized is not None else None


def _build_summary(detections: list[dict[str, Any]]) -> dict[str, Any]:
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


def _attach_issue_markers(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    missing_index = 1
    misplaced_index = 1
    enriched: list[dict[str, Any]] = []

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


def _split_compliance_notes(detections: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    visible_detections: list[dict[str, Any]] = []
    compliance_notes: list[str] = []

    for detection in detections:
        if detection.get("type") == "compliance_note":
            note = str(detection.get("note") or "").strip()
            if note:
                compliance_notes.append(note)
            continue

        visible_detections.append(detection)

    return visible_detections, compliance_notes


def _encode_image_data_uri(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded_image}"


def _analyze_saved_image(image_path: str) -> dict[str, Any]:
    (
        analyze_shelf_debug,
        draw_annotations,
        build_compliance_report,
    ) = _get_shelf_tools()

    debug_bundle = analyze_shelf_debug(image_path)
    raw_detections = debug_bundle["audit_results"]
    visible_detections, compliance_notes = _split_compliance_notes(raw_detections)
    detections = _attach_issue_markers(visible_detections)
    compliance_report = build_compliance_report(raw_detections)
    processed_image_path = debug_bundle["processed_image_path"]
    processed_image = Image.open(processed_image_path).convert("RGB")
    annotated_image = draw_annotations(processed_image, detections)

    return {
        "message": "Shelf analysis completed.",
        "summary": _build_summary(detections),
        "compliance_report": compliance_report,
        "detections": detections,
        "compliance_notes": compliance_notes,
        "annotated_image": _encode_image_data_uri(annotated_image),
    }


def analyze_shelf_bytes(image_bytes: bytes) -> dict[str, Any]:
    temp_path = None
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_path = temp_file.name
        image.save(temp_path, format="JPEG", quality=95)
        return _analyze_saved_image(temp_path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def create_shelf_analysis_job(
    *,
    image_bytes: bytes,
    original_filename: str | None = None,
    requested_by_user_id: int | None = None,
) -> ShelfAnalysisJob:
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")
    job = ShelfAnalysisJob(
        requested_by_user_id=requested_by_user_id,
        original_filename=original_filename,
        status=JOB_STATUS_QUEUED,
        input_image_b64=encoded_image,
    )
    db.session.add(job)
    db.session.commit()
    return job


def get_shelf_analysis_job(job_id: str) -> ShelfAnalysisJob | None:
    return ShelfAnalysisJob.query.get(job_id)


def serialize_shelf_analysis_job(job: ShelfAnalysisJob) -> dict[str, Any]:
    return {
        "job_id": job.job_id,
        "status": job.status,
        "original_filename": job.original_filename,
        "error_message": job.error_message,
        "worker_id": job.worker_id,
        "created_at": _isoformat(job.created_at),
        "started_at": _isoformat(job.started_at),
        "completed_at": _isoformat(job.completed_at),
        "result": job.result_payload,
    }


def claim_next_shelf_analysis_job(worker_id: str | None = None) -> ShelfAnalysisJob | None:
    job = (
        ShelfAnalysisJob.query
        .filter_by(status=JOB_STATUS_QUEUED)
        .order_by(ShelfAnalysisJob.created_at.asc(), ShelfAnalysisJob.job_id.asc())
        .first()
    )
    if job is None:
        return None

    job.status = JOB_STATUS_PROCESSING
    job.worker_id = worker_id
    job.started_at = datetime.now(timezone.utc)
    job.error_message = None
    db.session.commit()
    return job


def process_shelf_analysis_job(job_id: str, worker_id: str | None = None) -> dict[str, Any]:
    job = get_shelf_analysis_job(job_id)
    if job is None:
        raise LookupError(f"Shelf analysis job `{job_id}` not found")

    if job.status == JOB_STATUS_COMPLETED and job.result_payload is not None:
        return job.result_payload

    if job.status != JOB_STATUS_PROCESSING:
        job.status = JOB_STATUS_PROCESSING
        job.started_at = datetime.now(timezone.utc)
        job.worker_id = worker_id
        db.session.commit()

    try:
        if not job.input_image_b64:
            raise ValueError("Shelf analysis job is missing input image data")

        image_bytes = base64.b64decode(job.input_image_b64)
        result_payload = analyze_shelf_bytes(image_bytes)
        job.result_payload = result_payload
        job.status = JOB_STATUS_COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None
        db.session.commit()
        return result_payload
    except Exception as error:  # noqa: BLE001
        db.session.rollback()
        job = get_shelf_analysis_job(job_id)
        if job is not None:
            job.status = JOB_STATUS_FAILED
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = f"{error}\n{traceback.format_exc(limit=20)}"
            if worker_id:
                job.worker_id = worker_id
            db.session.commit()
        raise

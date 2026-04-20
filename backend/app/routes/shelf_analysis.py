import base64
import sys
import traceback
from pathlib import Path

from flask import Blueprint, jsonify, request


PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


shelf_analysis_blueprint = Blueprint("shelf_analysis", __name__)


def _get_job_services():
    from app.services.shelf_analysis_jobs import (
        analyze_shelf_bytes,
        create_shelf_analysis_job,
        get_shelf_analysis_job,
        serialize_shelf_analysis_job,
    )

    return (
        analyze_shelf_bytes,
        create_shelf_analysis_job,
        get_shelf_analysis_job,
        serialize_shelf_analysis_job,
    )


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

    try:
        analyze_shelf_bytes, _, _, _ = _get_job_services()
        payload = analyze_shelf_bytes(uploaded_file.read())
        return jsonify(payload), 200
    except Exception as error:
        traceback.print_exc()
        return jsonify({"message": f"Shelf analysis failed: {error}"}), 500


@shelf_analysis_blueprint.route("/jobs", methods=["POST", "OPTIONS"])
@shelf_analysis_blueprint.route("/jobs/", methods=["POST", "OPTIONS"])
def create_shelf_analysis():
    if request.method == "OPTIONS":
        return ("", 204)

    if "image" not in request.files:
        return jsonify({"message": "Upload an image file under the `image` field."}), 400

    uploaded_file = request.files["image"]
    if not uploaded_file.filename:
        return jsonify({"message": "Please choose an image file."}), 400

    try:
        _, create_shelf_analysis_job, _, serialize_shelf_analysis_job = _get_job_services()
        job = create_shelf_analysis_job(
            image_bytes=uploaded_file.read(),
            original_filename=uploaded_file.filename,
        )
        return jsonify(
            {
                "message": "Shelf analysis job created.",
                "job": serialize_shelf_analysis_job(job),
            }
        ), 202
    except Exception as error:
        traceback.print_exc()
        return jsonify({"message": f"Could not create shelf analysis job: {error}"}), 500


@shelf_analysis_blueprint.route("/jobs/<job_id>", methods=["GET"])
@shelf_analysis_blueprint.route("/jobs/<job_id>/", methods=["GET"])
def get_shelf_analysis(job_id: str):
    _, _, get_shelf_analysis_job, serialize_shelf_analysis_job = _get_job_services()
    job = get_shelf_analysis_job(job_id)
    if job is None:
        return jsonify({"message": "Shelf analysis job not found."}), 404

    return jsonify({"job": serialize_shelf_analysis_job(job)}), 200

from flask import Blueprint, jsonify
from app.models import Alerts
from app.util.auth import session


alert_blueprint = Blueprint("alert", __name__)


@alert_blueprint.route("/", methods=["GET"])
@alert_blueprint.route("", methods=["GET"])
@session
def alert_history(session):
    """Return the 100 most recent alerts, newest first."""
    try:
        alerts = (
            Alerts.query
            .filter(Alerts.user_id == session.user_id)
            .order_by(Alerts.sent_time.desc())
            .limit(100)
            .all()
        )
        return jsonify([
            {
                "id": a.id,
                "user_id": a.user_id,
                "shelf_analysis_log_id": a.shelf_analysis_log_id,
                "alert_type": a.alert_type,
                "missing": a.missing,
                "misplaced": a.misplaced,
                "sent_time": a.sent_time.isoformat() if a.sent_time else None,
            }
            for a in alerts
        ]), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

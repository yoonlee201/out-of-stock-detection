from flask import Blueprint, jsonify, request
from app.models import Alerts
from app.services.alert_services import send_out_of_stock_alerts

alert_blueprint = Blueprint("alert", __name__)


@alert_blueprint.route("/history", methods=["GET"])
def alert_history():
    """Return the 100 most recent alerts, newest first."""
    try:
        alerts = (
            Alerts.query
            .order_by(Alerts.sent_time.desc())
            .limit(100)
            .all()
        )
        return jsonify([
            {
                "id": a.id,
                "user_id": a.user_id,
                "product_id": a.product_id,
                "alert_type": a.alert_type,
                "sent_time": a.sent_time.isoformat() if a.sent_time else None,
            }
            for a in alerts
        ]), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@alert_blueprint.route("/send_out_of_stock", methods=["POST", "OPTIONS"])
def send_out_of_stock_alert():
    """Send SMS alerts to all active employees about out-of-stock items."""
    if request.method == "OPTIONS":
        return "", 204

    body = request.get_json(silent=True) or {}
    detected_items = body.get("detected_items", [])

    try:
        send_out_of_stock_alerts(detected_items)
        return jsonify({"success": True, "message": "Out of stock alerts sent"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

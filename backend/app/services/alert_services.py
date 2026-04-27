from app.core.db import db
from app.models import Alerts
from app.services.user_services import get_all_active_employees
from app.util.send import send_sms
from datetime import datetime


def send_out_of_stock_alerts(detected_items=None, shelf_analysis_log_id=None):
    """
    Send an SMS summary to every active employee and log one Alert row per
    employee that links back to the shelf analysis log for the scan.

    detected_items: list of detection dicts (with audit_status, etc.) used to
                    build the SMS summary and choose alert_type.
    shelf_analysis_log_id: id of the ShelfAnalysisLog row this scan produced.
                           Stored on each Alert row so the UI can navigate back
                           to the analysis result.
    """
    detected_items = detected_items or []

    missing_count = sum(1 for i in detected_items if i.get("audit_status") == "missing")
    misplaced_count = sum(1 for i in detected_items if i.get("audit_status") == "misplaced")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not detected_items:
        message = f"Shelf scan completed at {timestamp}. No detections."
    else:
        message = (
            f"Shelf scan at {timestamp}. "
            f"Total: {len(detected_items)}, Missing: {missing_count}, Misplaced: {misplaced_count}."
        )

    employees = get_all_active_employees()

    for user, _emp in employees:
        if user.phone:
            try:
                send_sms(user.phone, message, carrier=user.carrier or "verizon")
            except Exception as e:
                print(f"SMS failed for {user.email}: {e}")

        db.session.add(Alerts(
            user_id=user.user_id,
            shelf_analysis_log_id=shelf_analysis_log_id,
            alert_type="shelf_detection",
            missing=missing_count,
            misplaced=misplaced_count,
        ))

    db.session.commit()

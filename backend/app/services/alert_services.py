from app.core.db import db
from app.models import Alerts
from app.services.user_services import get_all_active_employees
from app.util.send import send_sms
from datetime import datetime


def send_out_of_stock_alerts(detected_items=None):
    """
    Send an SMS summary to every active employee and log one Alert row per
    detected item that has a product_id.

    detected_items: list of dicts with keys audit_status, product_id, etc.
                    Defaults to empty list (sends a "no detections" message).
    """
    detected_items = detected_items or []

    missing_count = sum(1 for i in detected_items if i.get("audit_status") == "missing")
    misplaced_count = sum(1 for i in detected_items if i.get("audit_status") == "misplaced")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not detected_items:
        message = f"[MCCS] Shelf scan completed at {timestamp}. No detections."
    else:
        message = (
            f"[MCCS] Shelf scan at {timestamp}. "
            f"Total: {len(detected_items)}, Missing: {missing_count}, Misplaced: {misplaced_count}."
        )

    employees = get_all_active_employees()

    for user, _emp in employees:
        if user.phone:
            try:
                send_sms(user.phone, message, carrier=user.carrier or "verizon")
            except Exception as e:
                print(f"SMS failed for {user.email}: {e}")

        for item in detected_items:
            product_id = item.get("product_id") if isinstance(item, dict) else getattr(item, "product_id", None)
            if product_id is not None:
                db.session.add(Alerts(
                    user_id=user.user_id,
                    product_id=product_id,
                    alert_type="out_of_stock",
                ))

    db.session.commit()


def seed_mock_alerts(user_id, product_ids, alert_types=None):
    """
    Insert a batch of mock Alert rows for development / demo purposes.
    Returns the list of created Alerts.
    """
    alert_types = alert_types or ["out_of_stock", "low_stock", "misplaced"]
    created = []
    for i, pid in enumerate(product_ids):
        alert = Alerts(
            user_id=user_id,
            product_id=pid,
            alert_type=alert_types[i % len(alert_types)],
        )
        db.session.add(alert)
        created.append(alert)
    db.session.commit()
    return created

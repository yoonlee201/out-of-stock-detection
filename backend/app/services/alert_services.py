from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from app.models import Users
from app.util.send import send_sms
from agent.db_ops import insert_alert


def send_out_of_stock_sms(detected_items=None):
    detected_items = detected_items or []

    total_count = len(detected_items)
    empty_space_count = sum(1 for item in detected_items if item.get("type") == "empty_space")
    missing_count = sum(1 for item in detected_items if item.get("audit_status") == "missing")
    misplaced_count = sum(1 for item in detected_items if item.get("audit_status") == "misplaced")
    correct_count = sum(1 for item in detected_items if item.get("audit_status") == "correct")
    unverified_count = sum(1 for item in detected_items if item.get("audit_status") == "unverified")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if total_count == 0:
        message = f"[MCCS] Shelf analysis completed at {timestamp}. No detections were returned."
    else:
        message = (
            f"[MCCS] Shelf analysis completed at {timestamp}. "
            f"Detections: {total_count}, Empty: {empty_space_count}, Missing: {missing_count}, "
            f"Misplaced: {misplaced_count}, Correct: {correct_count}, Unverified: {unverified_count}."
        )

    test_employee = Users.query.filter_by(email="one@example.com").first()
    employees = [test_employee] if test_employee else []

    print(f"Employees found: {len(employees)}")
    print(f"Sending alert to {len(employees)} employees")

    def send_to_one(employee):
        try:
            if not employee:
                print("Skipped empty employee")
                return

            if not employee.phone:
                print(f"Skipped {employee.email}: no phone number")
                return

            send_sms(employee.phone, message, carrier="tmobile")
            print("USING HARDCODED CARRIER")
            print(f"Sent SMS to {employee.email}")

            print("BEFORE DB LOGGING")
            print(f"About to log alerts for {len(detected_items)} detections")

            for item in detected_items:
                try:
                    product_id = None

                    if hasattr(item, "product_id"):
                        product_id = item.product_id
                    elif isinstance(item, dict):
                        product_id = item.get("product_id")

                    if product_id is not None:
                        alert_id = insert_alert(employee.user_id, product_id, "out_of_stock")
                        print(f"Logged alert {alert_id} for product {product_id}")
                    else:
                        print(f"Skipped DB log because no product_id was found: {item}")

                except Exception as e:
                    print(f"Failed to log alert for item {item}: {e}")

        except Exception as e:
            print(f"Failed to send SMS to {getattr(employee, 'email', 'unknown user')}: {e}")

    with ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(send_to_one, employees))
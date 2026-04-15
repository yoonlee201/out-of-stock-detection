from concurrent.futures import ThreadPoolExecutor
from app.util.send import send_sms
from app.services.product_services import get_low_stock_products
from app.models import Users
from agent.db_ops import insert_alert
from datetime import datetime


def send_out_of_stock_sms():
    products = get_low_stock_products()

    if not products:
        print("No out of stock products detected.")
        message = f"[MCCS] No out-of-stock products detected at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    else:
        message = f"[MCCS] {len(products)} item(s) out of stock. Please check the app for details. {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    test_employee = Users.query.filter_by(email='one@example.com').first()
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

            if products:
                print("BEFORE DB LOGGING")
                print(f"About to log alerts for {len(products)} products")

                for product in products:
                    try:
                        print(f"Trying to log product_id: {product.product_id}")
                        alert_id = insert_alert(employee.user_id, product.product_id, "out_of_stock")
                        print(f"Logged alert {alert_id} for product {product.product_id}")
                    except Exception as e:
                        print(f"Failed to log alert for product {product}: {e}")

        except Exception as e:
            print(f"Failed to send SMS to {getattr(employee, 'email', 'unknown user')}: {e}")

    with ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(send_to_one, employees))
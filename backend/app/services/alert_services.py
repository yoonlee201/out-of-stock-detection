from concurrent.futures import ThreadPoolExecutor
from app.util.send import send_sms
from app.services.product_services import get_low_stock_products
from app.models import Users



def send_out_of_stock_sms():
    products = get_low_stock_products()
    if not products:
        print("No out of stock products detected.")
        return

    #if session.role not in ('supervisor', 'manager'):
        #raise PermissionError("Only supervisors and managers can receive out of stock alerts")

    test_employee = Users.query.filter_by(email='albertwang041006@gmail.com').first()
    employees = [test_employee] if test_employee else []

    print(f"Employees found: {len(employees)}")
    print(f"Sending out of stock alert for {len(products)} products to {len(employees)} employees")

    message = f"[MCCS] {len(products)} item(s) out of stock. Please check the app for details."

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

        except Exception as e:
            print(f"Failed to send SMS to {getattr(employee, 'email', 'unknown user')}: {e}")

    with ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(send_to_one, employees))
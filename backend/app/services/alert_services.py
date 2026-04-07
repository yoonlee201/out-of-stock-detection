
from app.util.send import lookup_carrier, send_sms
from app.util.auth import session
from app.services.product_services import get_low_stock_products
from app.core.db import db
from app.models import Users


@session
def send_out_of_stock_sms(session):
    # Placeholder for sending an alert (e.g., email or SMS)
    products = get_low_stock_products()
    if not products:
        print("No out of stock products detected.")
        return
    if session.role not in ('supervisor', 'manager'):
        raise PermissionError("Only supervisors and managers can receive out of stock alerts")
    
    employees = [Users.query.filter_by(email='ylee201@vt.edu').first()]
        
    print(f"Sending out of stock alert for {len(products)} products to {len(employees)} employees")
    message = f"[MCCS] {len(products)} item(s) out of stock. Please check the app for details."
    for employee in employees:
        send_sms(employee.phone, message, carrier=employee.carrier)
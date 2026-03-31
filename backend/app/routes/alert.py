from app.services.user_services import get_all_active_employees

from app.services.alert_services import send_out_of_stock_sms
from flask import Blueprint, request, jsonify, make_response


alert_blueprint = Blueprint('alert', __name__)

@alert_blueprint.route('/')
@alert_blueprint.route('')
def index():
    employees = get_all_active_employees()
    return jsonify({
        "active_employees": [{
            "user_id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "joined_at": employee.joined_at.isoformat(),
            "status": employee.status
        } for user, employee in employees]
    })
    # send_email()
    
@alert_blueprint.route('/send_out_of_stock', methods=['POST', 'OPTIONS'])
def send_out_of_stock_alert():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        send_out_of_stock_sms()
        return jsonify({'success': True, 'message': 'Out of stock alerts sent'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

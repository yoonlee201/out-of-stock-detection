from flask import Blueprint, request, jsonify
from app.services.user_services import get_all_active_employees
from app.services.alert_services import send_out_of_stock_sms
from app.services.reorder_services import create_mock_reorders
from app.models import Alerts, Users, Products
from app.core.db import db


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


@alert_blueprint.route('/send_out_of_stock', methods=['POST', 'OPTIONS'])
def send_out_of_stock_alert():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        send_out_of_stock_sms()
        return jsonify({
            'success': True,
            'message': 'Out of stock alerts sent'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
    
@alert_blueprint.route('/history', methods=['GET'])
def get_alert_history():
    rows = (
        db.session.query(Alerts, Users, Products)
        .join(Users, Alerts.user_id == Users.user_id)
        .join(Products, Alerts.product_id == Products.product_id)
        .order_by(Alerts.sent_time.desc())
        .limit(100)
        .all()
    )

    return jsonify([{
        "id": alert.id,
        "alert_type": alert.alert_type,
        "sent_time": alert.sent_time.isoformat(),
        "user": {
            "user_id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        },
        "product": {
            "product_id": product.product_id,
            "name": product.name,
            "shelf": product.shelf,
            "aisle": product.aisle,
        },
    } for alert, user, product in rows]), 200


@alert_blueprint.route('/create_reorders', methods=['POST', 'OPTIONS'])
def create_reorders():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        reorders = create_mock_reorders()
        return jsonify({
            'success': True,
            'message': 'Mock reorders created',
            'reorders': reorders
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
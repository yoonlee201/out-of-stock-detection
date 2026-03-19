from flask import Blueprint, request, jsonify, make_response
from app.core.db import db 
from app.models import Employee, Users


alert_blueprint = Blueprint('alert', __name__)

@alert_blueprint.route('/')
@alert_blueprint.route('')
def index():
    employees = (
        db.session.query(Users, Employee)
        .join(Employee, Users.user_id == Employee.user_id)
        .filter(Employee.status == 'active')
        .all()
    )
    
    # send_email()
    
    
    
    

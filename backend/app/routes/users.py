# app/routes/users.py
import os
from flask import Blueprint, request, jsonify, make_response
from app.core.config import config
from app.util.auth import session, require_active_employee, require_active_manager
from app.util.send import lookup_carrier
from app.services.user_services import (
    generate_token,
    delete_token,
    check_password,
    
    get_user_by_email,
    get_all_users,
    get_all_employees,
    
    create_user,
    update_user_role,
    
    send_invitation_email,
    verify_invitation_token,
    complete_invitation,
    verify_email_token,
    
    role_is_employee,
    role_is_allowed,
)

users_blueprint = Blueprint('users', __name__)


@users_blueprint.route('/', methods=['GET'])
@users_blueprint.route('', methods=['GET'])
def get_users():
    users = get_all_users()
    return {
        "users": [{
            "id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "created_at": user.created_at
        } for user in users]
    }

# ----------------User authentication routes----------------
@users_blueprint.route('/register', methods=['POST', 'OPTIONS'])
@users_blueprint.route('/register/', methods=['POST', 'OPTIONS'])
def add_user():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.get_json()
    if data is None:
        return {"message": "Invalid JSON payload"}, 400
    
    # get required fields and validate
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'customer')
    
    # optional
    phone = data.get('phone')
    carrier = None

    if not first_name:
        return {"message": "First name is required"}, 400
    if not last_name:
        return {"message": "Last name is required"}, 400
    if not email:
        return {"message": "Email is required"}, 400
    if not password:
        return {"message": "Password is required"}, 400

    if role_is_employee(role=role):
        if not phone:
            return {"message": "Phone number is required for employees"}, 400
    if phone:
        carrier = lookup_carrier(phone)

    create_user(first_name, last_name, role, email, password, phone=phone, carrier=carrier)
    return {"message": "User added successfully"}, 201



@users_blueprint.route('/login', methods=['POST', 'OPTIONS'])
@users_blueprint.route('/login/', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        user = get_user_by_email(email)
        if not user:
            return {'message': 'User not found'}, 404

        if not check_password(user, password):
            return {'message': 'Incorrect password'}, 401

        if not user.is_verified:
            return {'message': 'Please verify your email before logging in'}, 403

        token = generate_token(user)

        response = jsonify({'message': 'Login successful', 'token': token})
        response.set_cookie(
            'authToken',
            token,
            httponly=True,
            secure=config.check_production(),
            # Use Lax in local/same-site dev for safer defaults; use None in production
            # so cross-site frontend<->backend cookie auth works (None requires Secure=True).
            samesite='None' if config.check_production() else 'Lax',
            max_age=7 * 24 * 60 * 60,
            path='/'
        )
        return response, 200

    except Exception as error:
        print(f"Error during login: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@users_blueprint.route('/validate', methods=['GET'])
@users_blueprint.route('/validate/', methods=['GET'])
@session
def validate(session):
    return jsonify({
        'success': True,
        'user': {
            'id': session.user_id,
            'email': session.email,
            'first_name': session.first_name,
            'last_name': session.last_name,
            'role': session.role,
            'phone': session.phone,
            'created_at': session.created_at.isoformat()
        }
    })
@users_blueprint.route('/logout', methods=['POST', 'OPTIONS'])
@users_blueprint.route('/logout/', methods=['POST', 'OPTIONS'])
@session
def logout(session):
    if request.method == 'OPTIONS':
        return '', 204
    
    token = request.cookies.get('authToken')
    delete_token(token)
    response = make_response(jsonify({'success': True, 'message': 'Logged out successfully'}))
    response.set_cookie('authToken', '', expires=0)
    return response, 200

@users_blueprint.route('/verify-email', methods=['GET'])
@users_blueprint.route('/verify-email/', methods=['GET'])
def verify_email():
    # Endpoint to verify user's email using a token sent via email.
    token = request.args.get("token")
    if not token:
        return {"message": "Verification token is required"}, 400

    user = verify_email_token(token)
    return {"message": "Email verified successfully", "email": user.email}, 200
   

# ----------------Employee management routes----------------
@users_blueprint.route('/employees', methods=['GET'])
@users_blueprint.route('/employees/', methods=['GET'])
@require_active_employee
def employees(session):
    rows = get_all_employees()
    return {
        "users": [{
            "id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
            "phone": user.phone,
            "carrier": user.carrier,
            "status": emp.status,
            "joined_at": emp.joined_at,
            "created_at": user.created_at
        } for user, emp in rows]
    }

@users_blueprint.route('/<int:user_id>/role', methods=['PATCH'])
@users_blueprint.route('/<int:user_id>/role/', methods=['PATCH'])
@require_active_manager
def update_role(user_id, session):
    data = request.get_json()
    if not data:
        return {"message": "Invalid JSON payload"}, 400

    new_role = data.get('role')
    if not new_role:
        return {"message": "Role is required"}, 400
    if not role_is_allowed(role=new_role):
        return {"message": f"Invalid role."}, 400

    update_user_role(user_id, new_role)
    
    return {"message": f"Role updated to '{new_role}'"}, 200

# ----------------Employee invitation routes----------------
@users_blueprint.route('/send_invitation', methods=['PATCH'])
@users_blueprint.route('/send_invitation/', methods=['PATCH'])
@require_active_manager
def send_invitation(session):
    data = request.get_json(silent=True)
    if not data:
        return {"message": "Invalid JSON payload"}, 400
    
    # get role to invite for, default to associate if not provided
    invited_role = data.get("role", "associate")
    email = data.get("email")
    
    if not role_is_employee(role=invited_role):
        return {"message": "Invalid role for invitation. Must be 'associate' or 'manager'"}, 400

    user = get_user_by_email(email)
    if not user:
        return {"message": "User not found"}, 404
    if user.role != "customer":
        return {"message": "User is already an employee"}, 422

    invitation_link = send_invitation_email(user, invited_role)
    return {"message": "Invitation sent", "invitation_link": invitation_link, "expires_in_hours": 168}, 200

@users_blueprint.route('/invitation/verify', methods=['GET'])
@users_blueprint.route('/invitation/verify/', methods=['GET'])
def verify_invitation():
    # token from link query param, not auth cookie
    token = request.args.get("token")
    if not token:
        return {"message": "Invitation token is required"}, 400

    user, invited_role = verify_invitation_token(token)
    return {
        "message": "Invitation is valid",
        "user": {
            "id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "phone": user.phone,
            "carrier": user.carrier,
            "role": user.role
        },
        "invited_role": invited_role
    }, 200

@users_blueprint.route('/invitation/complete', methods=['POST', 'OPTIONS'])
@users_blueprint.route('/invitation/complete/', methods=['POST', 'OPTIONS'])
def finish_invitation():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json(silent=True)
    if not data:
        return {"message": "Invalid JSON payload"}, 400
    # token from link query param, not auth cookie
    token = data.get("token")
    phone = data.get("phone")

    if not token:
        return {"message": "Invitation token is required"}, 400
    if not phone:
        return {"message": "Phone number is required"}, 400

    user = complete_invitation(token, phone)
    return {
        "message": "Invitation completed successfully",
        "user": {
            "id": user.user_id,
            "email": user.email,
            "role": user.role,
            "phone": user.phone,
            "carrier": user.carrier
        }
    }, 200

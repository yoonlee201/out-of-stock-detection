# app/routes/users.py
import os
from flask import Blueprint, request, jsonify, make_response
from app.services.user_services import (
    generate_token,
    check_password,
    get_user_by_email,
    get_user_by_token,
    get_user_by_id,
    get_all_users,
    create_user,
    update_user_role,
    get_all_employees,
    delete_token,
    send_invitation_email,
    verify_invitation_token,
    complete_invitation,
    verify_email_token,
)
from itsdangerous import SignatureExpired, BadSignature
from sqlalchemy.exc import IntegrityError


users_blueprint = Blueprint('users', __name__)

ALLOWED_ROLES = ('customer', 'associate', 'manager')
EMPLOYEE_ROLES = ('associate', 'manager')


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


@users_blueprint.route('/register', methods=['POST', 'OPTIONS'])
@users_blueprint.route('/register/', methods=['POST', 'OPTIONS'])
def add_user():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()
        if data is None:
            return {"message": "Invalid JSON payload"}, 400

        first_name = data.get('first_name')
        if not first_name:
            return {"message": "First name is required"}, 400

        last_name = data.get('last_name')
        if not last_name:
            return {"message": "Last name is required"}, 400

        role = data.get('role', 'customer')
        phone = data.get('phone')
        carrier = data.get('carrier')

        if role in EMPLOYEE_ROLES:
            if not phone:
                return {"message": "Phone number is required for employees"}, 400
            if not carrier:
                return {"message": "Carrier is required for employees"}, 400

        email = data.get('email')
        if not email:
            return {"message": "Email is required"}, 400

        password = data.get('password')
        if not password:
            return {"message": "Password is required"}, 400

        create_user(first_name, last_name, role, email, password, phone=phone, carrier=carrier)
        return {"message": "User added successfully"}, 201

    except ValueError as e:
        return {"message": str(e)}, 409
    except Exception as error:
        print(f"Error during registration: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


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

        is_production = os.getenv('FLASK_ENV') == 'production'
        response.set_cookie(
            'authToken',
            token,
            httponly=True,
            secure=is_production,
            samesite='None' if is_production else 'Lax',
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
def validate():
    token = request.cookies.get('authToken')
    if not token:
        return jsonify({'success': False, 'message': 'No token provided'}), 401

    try:
        user = get_user_by_token(token)
        if not user:
            return jsonify({'success': False, 'message': 'Invalid or expired token'}), 401

        return jsonify({
            'success': True,
            'user': {
                'id': user.user_id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'phone': user.phone,
                'created_at': user.created_at.isoformat()
            }
        })

    except Exception as error:
        print(f"Error during validation: {error}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@users_blueprint.route('/verify-email', methods=['GET'])
@users_blueprint.route('/verify-email/', methods=['GET'])
def verify_email():
    token = request.args.get("token")
    if not token:
        return {"message": "Verification token is required"}, 400

    try:
        user = verify_email_token(token)
        return {"message": "Email verified successfully", "email": user.email}, 200
    except SignatureExpired:
        return {"message": "Verification link has expired"}, 410
    except BadSignature:
        return {"message": "Invalid verification token"}, 400
    except LookupError as e:
        return {"message": str(e)}, 404


@users_blueprint.route('/logout', methods=['POST'])
@users_blueprint.route('/logout/', methods=['POST'])
def logout():
    token = request.cookies.get('authToken')
    try:
        if token:
            delete_token(token)

        response = make_response(jsonify({'success': True, 'message': 'Logged out successfully'}))
        response.set_cookie('authToken', '', expires=0)
        return response

    except Exception as error:
        print(f"Error during logout: {error}")
        return jsonify({'success': False, 'message': 'Failed to logout'}), 500


@users_blueprint.route('/<int:user_id>/role', methods=['PATCH'])
@users_blueprint.route('/<int:user_id>/role/', methods=['PATCH'])
def update_role(user_id):
    data = request.get_json()
    if not data:
        return {"message": "Invalid JSON payload"}, 400

    new_role = data.get('role')
    if not new_role:
        return {"message": "Role is required"}, 400

    if new_role not in ALLOWED_ROLES:
        return {"message": f"Invalid role. Must be one of: {', '.join(ALLOWED_ROLES)}"}, 400

    try:
        update_user_role(user_id, new_role)
        return {"message": f"Role updated to '{new_role}'"}, 200

    except LookupError as e:
        return {"message": str(e)}, 404
    except ValueError as e:
        return {"message": str(e)}, 422
    except Exception as error:
        print(f"Error updating role: {error}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@users_blueprint.route('/employees', methods=['GET'])
@users_blueprint.route('/employees/', methods=['GET'])
def employees():
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


@users_blueprint.route('/send_invitation', methods=['PATCH'])
@users_blueprint.route('/send_invitation/', methods=['PATCH'])
def send_invitation():
    data = request.get_json(silent=True) or {}
    invited_role = data.get("role", "associate")
    email = data.get("email")
    if invited_role not in EMPLOYEE_ROLES:
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
    token = request.args.get("token")
    if not token:
        return {"message": "Invitation token is required"}, 400

    try:
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
    except LookupError as e:
        return {"message": str(e)}, 404
    except SignatureExpired:
        return {"message": "Invitation link has expired"}, 410
    except BadSignature:
        return {"message": "Invalid invitation token"}, 400


@users_blueprint.route('/invitation/complete', methods=['POST'])
@users_blueprint.route('/invitation/complete/', methods=['POST'])
def finish_invitation():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    phone = data.get("phone")

    if not token:
        return {"message": "Invitation token is required"}, 400
    if not phone:
        return {"message": "Phone number is required"}, 400

    try:
        user = complete_invitation(token, phone)
        from app.core.db import db
        db.session.commit()
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
    except LookupError as e:
        return {"message": str(e)}, 404
    except ValueError as e:
        return {"message": str(e)}, 400
    except SignatureExpired:
        return {"message": "Invitation link has expired"}, 410
    except BadSignature:
        return {"message": "Invalid invitation token"}, 400
    except IntegrityError:
        from app.core.db import db
        db.session.rollback()
        return {"message": "Phone number already in use"}, 409
    except Exception as error:
        from app.core.db import db
        db.session.rollback()
        print(f"Error completing invitation: {error}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

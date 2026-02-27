# app/routes/users.py
import os
from flask import Blueprint, request, jsonify, make_response
from app.core.db import db 
from app.models import Users, Tokens
from app.services.user_services import generate_token, check_password


users_blueprint = Blueprint('users', __name__)

@users_blueprint.route('/', methods=['GET'])
@users_blueprint.route('', methods=['GET'])
def get_all_users():
    users = Users.query.all()
    return {
        "users": [{
            "id": user.id, 
            "name": user.name, 
            "email": user.email, 
            "created_at": user.created_at
        } for user in users]}

@users_blueprint.route('/user', methods=['POST'])
@users_blueprint.route('/user/', methods=['POST'])
def add_user():
    data = request.get_json(silent=True)
    
    if data is None:
        return {"message": "Invalid JSON payload"}, 400
    # first and last name are required
    first_name = data.get('first_name') if data else None
    if not first_name:
        return {"message": "Name is required"}, 400
    
    last_name = data.get('last_name') if data else None
    if not last_name:
        return {"message": "Name is required"}, 400
    
    phone = data.get('phone') if data else None
    if not phone:
        return {"message": "Phone number is required"}, 400
    
    email = data.get('email') if data else None
    if not email:
        return {"message": "Email is required"}, 400
    
    role = data.get('role') if data else None
    if not role:
        return {"message": "Role is required"}, 400
    
    password = data.get('password') if data else None
    if not password:
        return {"message": "Password is required"}, 400
        
    user = Users(
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        email=email,
        role=role
    )
    
    user.set_password(password)  # Hash password before saving
    
    db.session.add(user)
    db.session.commit()
    return {"message": "User added successfully"}, 201

# Login Route
@users_blueprint.route('/login', methods=['POST', 'OPTIONS'])
@users_blueprint.route('/login/', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 204
        
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    try:
        user = Users.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        if not check_password(user, password):
            return jsonify({
                'success': False,
                'message': 'Incorrect password'
            }), 401
        
        token = generate_token(user)
        
        response = make_response(jsonify({
            'success': True,
            'message': 'Login successful'
        }))
        
        # ✅ Update for production
        is_production = os.getenv('FLASK_ENV') == 'production'
        response.set_cookie(
            'authToken',
            token,
            httponly=True,
            secure=is_production,  # True in production
            samesite='None' if is_production else 'Lax',  # 'None' for cross-domain
            max_age=7*24*60*60,
            path='/'
        )
        
        return response
        
    except Exception as error:
        print(f"Error during login: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

# Validate Token Route
@users_blueprint.route('/validate', methods=['GET'])
@users_blueprint.route('/validate/', methods=['GET'])
def validate():
    token = request.cookies.get('authToken')
    
    if not token:
        return jsonify({
            'success': False,
            'message': 'No token provided'
        }), 401
    
    try:
        # Check if token exists and is not expired
        stored_token = Tokens.query.filter(
            Tokens.token == token,
            Tokens.expires > db.func.now()  # Database handles timezone
        ).first()
        print(f"Stored token: {stored_token}")
        
        if not stored_token:
            return jsonify({
                'success': False,
                'message': 'Invalid or expired token'
            }), 401
        
        user = Users.query.get(stored_token.user_id)
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name
            }
        })
        
    except Exception as error:
        print(f"Error during validation: {error}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500


# Logout Route
@users_blueprint.route('/logout', methods=['POST'])
@users_blueprint.route('/logout/', methods=['POST'])
def logout():
    token = request.cookies.get('authToken')
    
    try:
        # Delete token from database
        if token:
            Tokens.query.filter_by(token=token).delete()
            db.session.commit()
        
        response = make_response(jsonify({
            'success': True,
            'message': 'Logged out successfully'
        }))
        
        # Clear cookie
        response.set_cookie('authToken', '', expires=0)
        
        return response
        
    except Exception as error:
        print(f"Error during logout: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to logout'
        }), 500

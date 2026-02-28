from flask import request, jsonify, make_response
from app.core.db import db 
from app.models import Tokens
from datetime import datetime, timedelta
import uuid

def generate_token(user):
    """Generate and save a simple token"""
    print(f"Generating token for user: {user.user_id}")
    
    if not user.user_id:
        raise ValueError("User ID is None")
    
    token_value = uuid.uuid4()
    print(f"Token value: {token_value}")
    
    expires = datetime.utcnow() + timedelta(days=7)
    print(f"Token expires: {expires}")
    
    token = Tokens(
        token_id=token_value,
        user_id=user.user_id,
        expires=expires
    )
    
    db.session.add(token)
    db.session.commit()
    
    return str(token_value)

def check_password(user, password):
    """Check if the provided password matches the stored hash."""
    return user.check_password(password)
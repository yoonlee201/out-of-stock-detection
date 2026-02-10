from flask import request, jsonify, make_response
from app.core.db import db 
from app.models import Tokens
from datetime import datetime, timedelta
import uuid

def generate_token(user):
    """Generate and save a simple token"""
    print(f"Generating token for user: {user.id}")
    
    if not user.id:
        raise ValueError("User ID is None")
    
    token_value = uuid.uuid4()  # ✅ Don't convert to string
    print(f"Token value: {token_value}")
    
    expires = datetime.utcnow() + timedelta(days=7)
    print(f"Token expires: {expires}")
    
    token = Tokens(
        id=uuid.uuid4(),  # ✅ Don't convert to string
        user_id=user.id,  # ✅ Don't convert to string
        token=token_value,
        expires=expires
    )
    
    db.session.add(token)
    db.session.commit()
    
    return str(token_value)  # ✅ Convert to string only when returning to frontend
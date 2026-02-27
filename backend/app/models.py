import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.db import db

class Tokens(db.Model):
    __tablename__ = 'tokens'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    token = db.Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    expires = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=db.func.now())

class Users(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = db.Column(db.String(80), unique=True, nullable=False)
    last_name = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=True)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
     
    tokens = db.relationship('Tokens', backref='user', lazy=True, cascade='all, delete-orphan')



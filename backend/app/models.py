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

class GoogleTokens(db.Model):
    __tablename__ = 'google_tokens'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    access_token = db.Column(db.Text, nullable=False)
    refresh_token = db.Column(db.Text, nullable=True)
    token_type = db.Column(db.String(50), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=db.func.now())

class Users(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    google_id = db.Column(db.String(255), unique=True, nullable=True) 
    folder_id = db.Column(db.String(255), unique=True, nullable=True)
     
    tokens = db.relationship('Tokens', backref='user', lazy=True, cascade='all, delete-orphan')
    google_tokens = db.relationship('GoogleTokens', backref='user', lazy=True, cascade='all, delete-orphan')

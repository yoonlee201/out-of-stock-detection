import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.db import db

class Tokens(db.Model):
    __tablename__ = 'tokens'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    expires = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=db.func.now())

class Users(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = db.Column(db.String(80), unique=True, nullable=False)
    last_name = db.Column(db.String(80), unique=True, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=True)
    role = db.Column(db.String(50), nullable=False)  # e.g., 'associate', 'manager', 'customer'
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
     
    tokens = db.relationship('Tokens', backref='user', lazy=True, cascade='all, delete-orphan')

class Suppliers(db.Model):
    __tablename__ = 'suppliers'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)

class Products(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    qrcode = db.Column(db.String(100), unique=True, nullable=False)
    quantity_in_store = db.Column(db.Integer, nullable=False)
    shelf = db.Column(db.String(50), nullable=False)
    aisle = db.Column(db.String(50), nullable=False)
    supplier_id = db.Column(UUID(as_uuid=True), db.ForeignKey('suppliers.id'), nullable=False)

class Reorders(db.Model):
    __tablename__ = 'reorders'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(UUID(as_uuid=True), db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    
    

class Alerts(db.Model):
    __tablename__ = 'alerts'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(UUID(as_uuid=True), db.ForeignKey('products.id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)  # e.g., 'low_stock', 'out_of_stock'
    sent_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class InventoryLogs(db.Model):
    __tablename__ = 'inventory_logs'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = db.Column(UUID(as_uuid=True), db.ForeignKey('products.id'), nullable=False)
    change_type = db.Column(db.String(50), nullable=False)  # e.g., 'restock', 'sale', 'adjustment'
    quantity_changed = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), server_default=db.func.now())



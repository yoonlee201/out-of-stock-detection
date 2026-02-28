from app.core.db import db
import uuid
from sqlalchemy.dialects.postgresql import UUID
import bcrypt

class Tokens(db.Model):
    __tablename__ = 'tokens'
        
    token_id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    expires = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=db.func.now())

class Users(db.Model):
    __tablename__ = 'users'
    
    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    first_name = db.Column(db.String(80), unique=True, nullable=False)
    last_name = db.Column(db.String(80), unique=True, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    role = db.Column(db.String(50), nullable=False, default='customer')
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
     
    tokens = db.relationship('Tokens', backref='user', lazy=True, cascade='all, delete-orphan')
    
    

    def set_password(self, password):
        self.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password.encode('utf-8'))

class Suppliers(db.Model):
    __tablename__ = 'suppliers'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)

class Products(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    qrcode = db.Column(db.String(100), unique=True, nullable=False)
    quantity_in_store = db.Column(db.Integer, nullable=False)
    shelf = db.Column(db.String(50), nullable=False)
    aisle = db.Column(db.String(50), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)

class Reorders(db.Model):
    __tablename__ = 'reorders'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

class Alerts(db.Model):
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)
    sent_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

class InventoryLogs(db.Model):
    __tablename__ = 'inventory_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    change_type = db.Column(db.String(50), nullable=False)
    quantity_changed = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

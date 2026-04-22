from app.core.db import db
import uuid
import bcrypt

class Tokens(db.Model):
    __tablename__ = 'tokens'

    # String(36) stores UUID as text — works on PostgreSQL, SQLite, and MySQL.
    token_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    expires = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=db.func.now())

class Users(db.Model):
    __tablename__ = 'users'
    
    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=True)
    carrier = db.Column(db.String(50), nullable=True)
    role = db.Column(db.String(50), nullable=False, default='customer')
    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    
    tokens = db.relationship('Tokens', backref='user', lazy=True, cascade='all, delete-orphan')
    

    def set_password(self, password):
        self.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password.encode('utf-8'))

class Employee(db.Model):
    __tablename__ = 'employee'
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True)
    joined_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    status = db.Column(db.String(20), nullable=False, default='inactive')
    
    user = db.relationship('Users', backref=db.backref('employee', uselist=False), lazy=True)

class Suppliers(db.Model):
    __tablename__ = 'suppliers'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)

class Products(db.Model):
    __tablename__ = 'products'

    product_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    brand = db.Column(db.String(80), nullable=False, server_default='')
    variant = db.Column(db.String(80), nullable=False, server_default='')
    size = db.Column(db.String(50), nullable=False, server_default='')
    type = db.Column(db.String(50), nullable=False)
    qrcode = db.Column(db.String(100), unique=True, nullable=False)
    quantity_in_store = db.Column(db.Integer, nullable=False)
    shelf = db.Column(db.String(50), nullable=False)
    aisle = db.Column(db.String(50), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    # Set by shelf detection — 'on_shelf', 'missing', 'misplaced', 'unknown'
    shelf_status = db.Column(db.String(50), nullable=False, server_default='unknown')
    last_checked = db.Column(db.DateTime(timezone=True), nullable=True)


class ShelfAnalysisLog(db.Model):
    __tablename__ = 'shelf_analysis_logs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=True)
    file_name = db.Column(db.String(255), nullable=False)
    result_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

class Reorders(db.Model):
    __tablename__ = 'reorders'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.product_id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

class Alerts(db.Model):
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.product_id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)
    sent_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

class InventoryLogs(db.Model):
    __tablename__ = 'inventory_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.product_id'), nullable=False)
    change_type = db.Column(db.String(50), nullable=False)
    quantity_changed = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

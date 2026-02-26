-- Create the database
CREATE DATABASE shelf_monitor_db;

-- Connect to it: \c shelf_monitor_db

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL,  -- e.g., 'associate', 'manager'
    email VARCHAR(100) UNIQUE NOT NULL
);

-- Suppliers table
CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20)
);

-- Products table
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),  -- e.g., 'diary', 'meat'
    qrcode VARCHAR(100) UNIQUE,
    quantity_in_store INTEGER DEFAULT 0 CHECK (quantity_in_store >= 0),
    shelf VARCHAR(50),
    aisle VARCHAR(50),
    supplier_id INTEGER REFERENCES suppliers(supplier_id) ON DELETE SET NULL
);

-- Reorders table (for when stock is low and needs ordering from supplier)
CREATE TABLE reorders (
    reorder_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(product_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table (notifications to users about missing/low stock)
CREATE TABLE alerts (
    alert_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(product_id) ON DELETE CASCADE,
    sent_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Indexes for faster queries
CREATE INDEX idx_product_name ON products(name);
CREATE INDEX idx_alerts_user ON alerts(user_id);

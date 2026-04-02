-- Create the database
DROP DATABASE IF EXISTS shelf_monitor_db;

CREATE DATABASE shelf_monitor_db;
\c shelf_monitor_db

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS reorders CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS inventory_logs CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS employee CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS brand CASCADE;
DROP TABLE IF EXISTS uom CASCADE;
DROP TABLE IF EXISTS product_vendor CASCADE;
DROP TABLE IF EXISTS address CASCADE;
DROP TABLE IF EXISTS site CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS shelf CASCADE;
DROP TABLE IF EXISTS shelf_position CASCADE;
DROP TABLE IF EXISTS planogram CASCADE;
DROP TABLE IF EXISTS planogram_shelf CASCADE;
DROP TABLE IF EXISTS planogram_item CASCADE;
DROP TABLE IF EXISTS inventory_balance CASCADE;
DROP TABLE IF EXISTS inventory_movement CASCADE;
DROP TABLE IF EXISTS replenishment_rule CASCADE;

DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS employee_status_enum CASCADE;
CREATE TYPE user_role_enum AS ENUM ('customer', 'associate', 'supervisor', 'manager');
CREATE TYPE employee_status_enum AS ENUM ('active', 'inactive', 'pending');

-- Users
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    password VARCHAR(128) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    carrier VARCHAR(50),
    role user_role_enum NOT NULL DEFAULT 'customer',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(120) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Employee
CREATE TABLE employee (
    user_id INTEGER PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status employee_status_enum DEFAULT 'inactive'
);

-- Suppliers
CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(60) UNIQUE,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    supplier_name VARCHAR(200),
    lead_time_days INTEGER DEFAULT 0,
    min_order_qty INTEGER DEFAULT 1,
    status VARCHAR(30) DEFAULT 'active'
);

-- Reference tables
CREATE TABLE product_categories (
    category_id SERIAL PRIMARY KEY,
    parent_category_id INTEGER REFERENCES product_categories (category_id) ON DELETE SET NULL,
    category_name VARCHAR(200) NOT NULL,
    category_type VARCHAR(50)
);

CREATE TABLE brand (
    brand_id SERIAL PRIMARY KEY,
    brand_name VARCHAR(200) NOT NULL
);

CREATE TABLE uom (
    uom_id SERIAL PRIMARY KEY,
    uom_code VARCHAR(30) UNIQUE,
    uom_name VARCHAR(100)
);

-- Products
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    sku_code VARCHAR(60) UNIQUE,
    upc_code VARCHAR(30),
    name VARCHAR(100) NOT NULL,
    brand_id INTEGER REFERENCES brand (brand_id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES product_categories (category_id) ON DELETE SET NULL,
    uom_id INTEGER REFERENCES uom (uom_id) ON DELETE SET NULL,
    type VARCHAR(50),
    qrcode VARCHAR(100) UNIQUE,
    pack_size VARCHAR(100),
    size_text VARCHAR(100),
    is_perishable BOOLEAN DEFAULT FALSE,
    shelf_life_days INTEGER,
    status VARCHAR(30) DEFAULT 'active',
    quantity_in_store INTEGER DEFAULT 0 CHECK(quantity_in_store >= 0),
    shelf VARCHAR(50),
    aisle VARCHAR(50),
    supplier_id INTEGER REFERENCES suppliers (supplier_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_vendor (
    product_vendor_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers (supplier_id) ON DELETE CASCADE,
    vendor_sku VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    cost NUMERIC(12,4),
    case_pack INTEGER,
    lead_time_days INTEGER,
    min_order_qty INTEGER,
    active_flag BOOLEAN DEFAULT TRUE
);

-- Logistics tables
CREATE TABLE address (
    address_id SERIAL PRIMARY KEY,
    line1 VARCHAR(200),
    line2 VARCHAR(200),
    city VARCHAR(100),
    state_code VARCHAR(30),
    postal_code VARCHAR(30),
    country_code VARCHAR(30)
);

CREATE TABLE site (
    site_id SERIAL PRIMARY KEY,
    site_code VARCHAR(60) UNIQUE,
    site_name VARCHAR(200) NOT NULL,
    site_type VARCHAR(30),
    address_id INTEGER REFERENCES address (address_id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'active'
);

CREATE TABLE location (
    location_id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES site (site_id) ON DELETE CASCADE,
    parent_location_id INTEGER REFERENCES location (location_id) ON DELETE SET NULL,
    location_code VARCHAR(100),
    location_name VARCHAR(200),
    location_type VARCHAR(50),
    x_coord NUMERIC(12,4),
    y_coord NUMERIC(12,4),
    z_coord NUMERIC(12,4),
    status VARCHAR(30) DEFAULT 'active'
);

CREATE TABLE shelf (
    shelf_id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES location (location_id) ON DELETE CASCADE,
    shelf_code VARCHAR(100),
    shelf_level INTEGER,
    width_cm NUMERIC(12,2),
    height_cm NUMERIC(12,2),
    depth_cm NUMERIC(12,2),
    facing_capacity_units INTEGER,
    status VARCHAR(30) DEFAULT 'active'
);

CREATE TABLE shelf_position (
    shelf_position_id SERIAL PRIMARY KEY,
    shelf_id INTEGER REFERENCES shelf (shelf_id) ON DELETE CASCADE,
    position_index INTEGER,
    x_start NUMERIC(12,4),
    x_end NUMERIC(12,4),
    y_start NUMERIC(12,4),
    y_end NUMERIC(12,4),
    z_start NUMERIC(12,4),
    z_end NUMERIC(12,4),
    max_facings INTEGER,
    status VARCHAR(30) DEFAULT 'active'
);

-- Planogram and system tables
CREATE TABLE planogram (
    planogram_id SERIAL PRIMARY KEY,
    planogram_code VARCHAR(60) UNIQUE,
    site_id INTEGER REFERENCES site (site_id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES product_categories (category_id) ON DELETE SET NULL,
    effective_start_dt TIMESTAMPTZ,
    effective_end_dt TIMESTAMPTZ,
    version_no INTEGER,
    status VARCHAR(30) DEFAULT 'active',
    created_by INTEGER REFERENCES users (user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE planogram_shelf (
    planogram_shelf_id SERIAL PRIMARY KEY,
    planogram_id INTEGER REFERENCES planogram (planogram_id) ON DELETE CASCADE,
    shelf_id INTEGER REFERENCES shelf (shelf_id) ON DELETE CASCADE,
    shelf_template_name VARCHAR(100),
    shelf_width_cm NUMERIC(12,2),
    shelf_height_cm NUMERIC(12,2),
    shelf_level INTEGER
);

CREATE TABLE planogram_item (
    planogram_item_id SERIAL PRIMARY KEY,
    planogram_shelf_id INTEGER REFERENCES planogram_shelf (planogram_shelf_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    expected_facings INTEGER,
    expected_units INTEGER,
    min_shelf_qty INTEGER,
    replenishment_pt INTEGER,
    priority_rank INTEGER,
    x_start NUMERIC(12,4),
    x_end NUMERIC(12,4),
    y_start NUMERIC(12,4),
    y_end NUMERIC(12,4)
);

CREATE TABLE replenishment_rule (
    replenishment_rule_id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES site (site_id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES location (location_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    planogram_item_id INTEGER REFERENCES planogram_item (planogram_item_id) ON DELETE CASCADE,
    min_shelf_qty INTEGER,
    target_shelf_qty INTEGER,
    reorder_point INTEGER,
    reorder_qty INTEGER,
    preferred_source VARCHAR(100),
    active_flag BOOLEAN DEFAULT TRUE
);

CREATE TABLE inventory_balance (
    inv_balance_id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES site (site_id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES location (location_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    qty_on_hand INTEGER DEFAULT 0,
    qty_reserved INTEGER DEFAULT 0,
    qty_available INTEGER DEFAULT 0,
    qty_damaged INTEGER DEFAULT 0,
    qty_in_transit INTEGER DEFAULT 0,
    lot_number VARCHAR(100),
    expiry_date DATE,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_movement (
    movement_id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES site (site_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    from_location_id INTEGER REFERENCES location (location_id),
    to_location_id INTEGER REFERENCES location (location_id),
    movement_type VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    qty INTEGER,
    unit_cost NUMERIC(12,4),
    performed_by INTEGER REFERENCES users (user_id),
    reason_code VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Reorders
CREATE TABLE reorders (
    reorder_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (user_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Alerts
CREATE TABLE alerts (
    alert_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (user_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    sent_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Inventory logs
CREATE TABLE inventory_logs (
    log_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products (product_id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tokens
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users (user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX idx_product_name ON products (name);
CREATE INDEX idx_alerts_user ON alerts (user_id);
CREATE INDEX idx_inventory_balance_product ON inventory_balance (product_id);
CREATE INDEX idx_planogram_item_product ON planogram_item (product_id);

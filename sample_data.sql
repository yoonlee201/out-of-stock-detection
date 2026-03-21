-- =====================================================================
-- seed_mock_data.sql
-- Populates shelf_monitor_db with realistic mock/test data
-- Run AFTER your CREATE TABLE statements
-- =====================================================================

-- Optional: Clear existing data first (uncomment if you want a fresh start)
-- TRUNCATE TABLE tokens, inventory_logs, alerts, reorders, products, suppliers, users RESTART IDENTITY CASCADE;

-- Users (All fake users)
-- Mock data for users
-- password for all users is 12345678
INSERT INTO users (first_name, last_name, password, phone, role, email, is_verified) VALUES
('Maria',    'Gonzalez', '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '703-555-0123', 'supervisor', 'one@example.com', TRUE),
('James',    'Carter',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '757-555-0198', 'manager',   'james.carter@mccs.mil', TRUE),
('Michael',  'Lee',      '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '804-555-0765', 'manager','michael.lee@mccs.mil', TRUE),
('Sarah',    'Johnson',  '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '540-555-0341', 'associate', 'sarah.j@mccs.mil', TRUE),
('Robert',   'Wilson',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '202-555-1123', 'associate', 'robert.w@mccs.mil', TRUE),
('Linda',    'Martinez', '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '301-555-1456', 'associate',   'linda.m@mccs.mil', TRUE),
('Emily',    'Davis',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '571-555-0882', 'customer',  'emily.davis@email.com', TRUE),
('David',    'Brown',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '703-555-1678', 'customer', 'david.brown@email.com', TRUE),
('Jessica',  'Taylor',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '540-555-1890', 'customer', 'jessica.t@email.com', FALSE),
('Kevin',    'Anderson', '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '757-555-2034', 'customer', 'kevin.anderson@email.com', TRUE),
('Olivia',   'Moore',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '804-555-2199', 'customer', 'olivia.moore@email.com', TRUE),
('Ethan',    'Harris',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '571-555-2276', 'customer', 'ethan.harris@email.com', FALSE),
('Sophia',   'Clark',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '301-555-2381', 'customer', 'sophia.clark@email.com', TRUE),
('Noah',     'Lewis',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '202-555-2447', 'customer', 'noah.lewis@email.com', TRUE);
INSERT INTO employee (user_id, status)
VALUES (SELECT user_id FROM "users" WHERE first_name = 'Maria', 'active'),
    (SELECT user_id FROM "users" WHERE first_name = 'James', 'active'),
    (SELECT user_id FROM "users" WHERE first_name = 'Michael', 'active'),
    (SELECT user_id FROM "users" WHERE first_name = 'Sarah', 'active'),
    (SELECT user_id FROM "users" WHERE first_name = 'Robert', 'active'),
    (SELECT user_id FROM "users" WHERE first_name = 'Linda', 'active'),
    (SELECT user_id FROM "users" WHERE first_name = 'Emily', 'inactive'),
    (SELECT user_id FROM "users" WHERE first_name = 'David', 'inactive'),
    ;

-- Suppliers
INSERT INTO suppliers (email, phone_number) VALUES
('sysco@suppliers.com',          '800-555-0101'),
('usfoods@distro.com',           '888-555-0202'),
('kehe@distributors.net',        '877-555-0303'),
('c&swholesale@supplyco.com',    '800-555-0404'),
('performancefood@group.com',    '866-555-0505'),
('unfi@naturalfoods.com',        '800-555-0606'),
('dairyfarmers@coop.com',        '855-555-0707'),
('freshpoint@produce.com',       '877-555-0808'),
('localmeat@regional.com',       '540-555-0912');

-- Products (realistic grocery items + some variety)
INSERT INTO products (name, type, qrcode, quantity_in_store, shelf, aisle, supplier_id) VALUES
('Whole Milk 1gal',       'dairy',    'QR-MILK-001',  18, 'Shelf 3', 'Aisle 3', 7),
('2% Reduced Fat Milk',   'dairy',    'QR-MILK-002',  12, 'Shelf 3', 'Aisle 3', 7),
('Ground Beef 80/20',     'meat',     'QR-BEEF-001',   8, 'Shelf 2', 'Aisle 7', 9),
('Boneless Chicken Breast','meat',     'QR-CHKN-001',  22, 'Shelf 1', 'Aisle 7', 9),
('Bananas (bunch)',       'produce',  'QR-BANA-001',  45, 'Shelf 1', 'Aisle 1', 8),
('Roma Tomatoes 1lb',     'produce',  'QR-TOMA-001',  14, 'Shelf 2', 'Aisle 1', 8),
('Sourdough Bread',       'bakery',   'QR-BRED-001',   9, 'Shelf 5', 'Aisle 2', 2),
('Orange Juice 64oz',     'beverage', 'QR-OJ-001',    16, 'Shelf 4', 'Aisle 4', 5),
('Frozen Pepperoni Pizza','frozen',   'QR-PIZA-001',   7, 'Freezer 2','Aisle 8', 5),
('Classic Potato Chips',  'snacks',   'QR-CHIP-001',  31, 'Shelf 4', 'Aisle 6', 4),
('Tomato Soup 10.75oz',   'canned',   'QR-SOUP-001',  24, 'Shelf 6', 'Aisle 5', 3),
('Shampoo 13oz',          'personal care', 'QR-SHMP-001', 11, 'Shelf 1', 'Aisle 9', 6),
('Greek Yogurt Plain',    'dairy',    'QR-YOGT-001',   5, 'Shelf 4', 'Aisle 3', 7),
('Eggs Large 12ct',       'dairy',    'QR-EGGS-001',  19, 'Shelf 5', 'Aisle 3', 7),
('Apples Gala 3lb bag',   'produce',  'QR-APPL-001',  28, 'Shelf 1', 'Aisle 1', 8),
('Cheddar Cheese Block',  'dairy',    'QR-CHED-001',   6, 'Shelf 6', 'Aisle 3', 7),
('Pasta Sauce Marinara',  'canned',   'QR-SAUCE-001', 17, 'Shelf 7', 'Aisle 5', 3),
('Toilet Paper 12 rolls', 'personal care', 'QR-TP-001', 13, 'Shelf 3', 'Aisle 10',6);

-- Alerts (some low stock, out of stock, etc.)
INSERT INTO alerts (user_id, product_id, alert_type, sent_time) VALUES
(1,  1,  'low_stock',        NOW() - INTERVAL '2 hours'),
(2,  3,  'out_of_stock',     NOW() - INTERVAL '45 minutes'),
(3,  5,  'low_stock',        NOW() - INTERVAL '1 day'),
(4,  9,  'out_of_stock',     NOW() - INTERVAL '3 hours'),
(5, 10,  'low_stock',        NOW() - INTERVAL '30 minutes'),
(7, 13,  'out_of_stock',     NOW() - INTERVAL '90 minutes'),
(1, 14,  'low_stock',        NOW() - INTERVAL '4 hours'),
(2,  2,  'low_stock',        NOW() - INTERVAL '1 hour'),
(3,  8,  'out_of_stock',     NOW() - INTERVAL '2 days'),
(6, 16,  'low_stock',        NOW());

-- Reorders (mostly managers/associates placing orders)
INSERT INTO reorders (user_id, product_id, quantity, created_time) VALUES
(1,  1,  48,  NOW() - INTERVAL '1 day'),
(7,  3,  60,  NOW() - INTERVAL '3 hours'),
(2,  9,  36,  NOW() - INTERVAL '45 minutes'),
(1, 13,  24,  NOW() - INTERVAL '2 days'),
(4,  5,  72,  NOW() - INTERVAL '6 hours'),
(5, 10,  48,  NOW() - INTERVAL '1 hour'),
(7, 14,  30,  NOW());

-- Inventory Logs (some stock changes over time)

INSERT INTO inventory_logs (product_id, change_type, quantity_change, timestamp) VALUES
(1,  'sale',           -6,   NOW() - INTERVAL '1 hour'),
(1,  'restock',        +48,  NOW() - INTERVAL '2 days'),
(3,  'sale',           -12,  NOW() - INTERVAL '30 minutes'),
(5,  'sale',           -18,  NOW() - INTERVAL '4 hours'),
(9,  'damage',         -4,   NOW() - INTERVAL '1 day'),
(10, 'restock',        +36,  NOW() - INTERVAL '3 days'),
(13, 'sale',           -8,   NOW() - INTERVAL '2 hours'),
(14, 'reorder_received',+24,NOW() - INTERVAL '1 day'),
(2,  'sale',           -5,   NOW() - INTERVAL '45 minutes'),
(8,  'sale',           -10,  NOW());

-- Done!
SELECT 'Mock data inserted successfully.' AS status;

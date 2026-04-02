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
('Maria',    'Gonzalez', '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '703-555-0123', 'supervisor'::user_role_enum, 'one@example.com', TRUE),
('James',    'Carter',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '757-555-0198', 'manager'::user_role_enum,   'james.carter@mccs.mil', TRUE),
('Michael',  'Lee',      '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '804-555-0765', 'manager'::user_role_enum,'michael.lee@mccs.mil', TRUE),
('Sarah',    'Johnson',  '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '540-555-0341', 'associate'::user_role_enum, 'sarah.j@mccs.mil', TRUE),
('Robert',   'Wilson',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '202-555-1123', 'associate'::user_role_enum, 'robert.w@mccs.mil', TRUE),
('Linda',    'Martinez', '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '301-555-1456', 'associate'::user_role_enum,   'linda.m@mccs.mil', TRUE),
('Emily',    'Davis',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '571-555-0882', 'customer'::user_role_enum,  'emily.davis@email.com', TRUE),
('David',    'Brown',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '703-555-1678', 'customer'::user_role_enum, 'david.brown@email.com', TRUE),
('Jessica',  'Taylor',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '540-555-1890', 'customer'::user_role_enum, 'jessica.t@email.com', FALSE),
('Kevin',    'Anderson', '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '757-555-2034', 'customer'::user_role_enum, 'kevin.anderson@email.com', TRUE),
('Olivia',   'Moore',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '804-555-2199', 'customer'::user_role_enum, 'olivia.moore@email.com', TRUE),
('Ethan',    'Harris',   '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '571-555-2276', 'customer'::user_role_enum, 'ethan.harris@email.com', FALSE),
('Sophia',   'Clark',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '301-555-2381', 'customer'::user_role_enum, 'sophia.clark@email.com', TRUE),
('Noah',     'Lewis',    '$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u', '202-555-2447', 'customer'::user_role_enum, 'noah.lewis@email.com', TRUE);
INSERT INTO employee (user_id, "status")
SELECT user_id, 'active'::employee_status_enum FROM users WHERE first_name = 'Maria'    
UNION ALL
SELECT user_id, 'active'::employee_status_enum FROM users WHERE first_name = 'James'
UNION ALL
SELECT user_id, 'active'::employee_status_enum FROM users WHERE first_name = 'Michael'
UNION ALL
SELECT user_id, 'active'::employee_status_enum FROM users WHERE first_name = 'Sarah'
UNION ALL
SELECT user_id, 'active'::employee_status_enum FROM users WHERE first_name = 'Robert'
UNION ALL
SELECT user_id, 'active'::employee_status_enum FROM users WHERE first_name = 'Linda'
UNION ALL
SELECT user_id, 'inactive'::employee_status_enum FROM users WHERE first_name = 'Emily'
UNION ALL
SELECT user_id, 'inactive'::employee_status_enum FROM users WHERE first_name = 'David';

-- Suppliers
INSERT INTO suppliers (supplier_code, email, phone_number, supplier_name, lead_time_days, min_order_qty, status) VALUES
('SYSCO', 'sysco@suppliers.com',          '800-555-0101', 'Sysco', 5, 1, 'active'),
('USFOODS','usfoods@distro.com',           '888-555-0202', 'US Foods', 5, 1, 'active'),
('KEHE',   'kehe@distributors.net',        '877-555-0303', 'KeHE', 7, 1, 'active'),
('CNS',    'c&swholesale@supplyco.com',    '800-555-0404', 'C&S Wholesale', 6, 1, 'active'),
('PFG',    'performancefood@group.com',    '866-555-0505', 'Performance Food', 5, 1, 'active'),
('UNFI',   'unfi@naturalfoods.com',        '800-555-0606', 'UNFI', 8, 1, 'active'),
('DFCO',   'dairyfarmers@coop.com',        '855-555-0707', 'Dairy Farmers of America', 7, 1, 'active'),
('FRSH',   'freshpoint@produce.com',       '877-555-0808', 'FreshPoint', 6, 1, 'active'),
('LOCL',   'localmeat@regional.com',       '540-555-0912', 'Local Meat Co', 7, 1, 'active');

-- Product categories
INSERT INTO product_categories (category_name, category_type) VALUES
('Dairy', 'GROCERY'),
('Meat', 'GROCERY'),
('Produce', 'GROCERY'),
('Bakery', 'GROCERY'),
('Beverage', 'GROCERY'),
('Frozen', 'GROCERY'),
('Snacks', 'GROCERY'),
('Canned Goods', 'GROCERY'),
('Personal Care', 'NON_GROCERY');

-- Brands
INSERT INTO brand (brand_name) VALUES
('Private Label'),
('Brand A'),
('Brand B'),
('Brand C');

-- Units of measure
INSERT INTO uom (uom_code, uom_name) VALUES
('EA', 'Each'),
('LB', 'Pound'),
('KG', 'Kilogram'),
('OZ', 'Ounce'),
('CT', 'Count');

-- Products (realistic grocery items + some variety)
INSERT INTO products (sku_code, upc_code, name, brand_id, category_id, uom_id, type, qrcode, quantity_in_store, shelf, aisle, supplier_id, pack_size, size_text, is_perishable, shelf_life_days, status) VALUES
('MILK-1G', '000000000001', 'Whole Milk 1gal', 1, 1, 5, 'dairy', 'QR-MILK-001', 18, 'Shelf 3', 'Aisle 3', 7, '1 gal', '1 gallon', TRUE, 10, 'active'),
('MILK-2P', '000000000002', '2% Reduced Fat Milk', 1, 1, 5, 'dairy', 'QR-MILK-002', 12, 'Shelf 3', 'Aisle 3', 7, '64 oz', '64 ounces', TRUE, 10, 'active'),
('BEEF-80', '000000000003', 'Ground Beef 80/20', 2, 2, 2, 'meat', 'QR-BEEF-001', 8, 'Shelf 2', 'Aisle 7', 9, '1 lb', '1 pound', TRUE, 7, 'active'),
('CHKN-BR', '000000000004', 'Boneless Chicken Breast', 2, 2, 2, 'meat', 'QR-CHKN-001', 22, 'Shelf 1', 'Aisle 7', 9, '2 lb', '2 pounds', TRUE, 7, 'active'),
('BANA-01', '000000000005', 'Bananas (bunch)', 1, 3, 5, 'produce', 'QR-BANA-001', 45, 'Shelf 1', 'Aisle 1', 8, '1 bunch', 'per bunch', TRUE, 5, 'active'),
('TOMA-1L', '000000000006', 'Roma Tomatoes 1lb', 1, 3, 2, 'produce', 'QR-TOMA-001', 14, 'Shelf 2', 'Aisle 1', 8, '1 lb', '1 pound', TRUE, 5, 'active'),
('BRD-01', '000000000007', 'Sourdough Bread', 1, 4, 5, 'bakery', 'QR-BRED-001', 9, 'Shelf 5', 'Aisle 2', 2, '1 each', 'one loaf', TRUE, 3, 'active'),
('OJ-64', '000000000008', 'Orange Juice 64oz', 1, 5, 5, 'beverage', 'QR-OJ-001', 16, 'Shelf 4', 'Aisle 4', 5, '64 oz', '64 ounces', TRUE, 15, 'active'),
('PIZ-01', '000000000009', 'Frozen Pepperoni Pizza', 2, 6, 5, 'frozen', 'QR-PIZA-001', 7, 'Freezer 2', 'Aisle 8', 5, '1 each', 'one pizza', TRUE, 180, 'active'),
('CHIP-01','000000000010','Classic Potato Chips', 3, 7, 5, 'snacks', 'QR-CHIP-001', 31, 'Shelf 4', 'Aisle 6',4,'8 oz','8 ounces',FALSE,365,'active'),
('SOUP-10','000000000011','Tomato Soup 10.75oz', 3, 8, 5, 'canned', 'QR-SOUP-001', 24, 'Shelf 6','Aisle 5',3,'10.75 oz','10.75 ounces',FALSE,730,'active'),
('SHMP-13','000000000012','Shampoo 13oz', 4, 9, 5, 'personal care', 'QR-SHMP-001',11,'Shelf 1','Aisle 9',6,'13 oz','13 ounces',FALSE,365,'active'),
('YOGT-PL','000000000013','Greek Yogurt Plain',1,1,5,'dairy','QR-YOGT-001',5,'Shelf 4','Aisle 3',7,'6 oz','6 ounces',TRUE,14,'active'),
('EGGS-12','000000000014','Eggs Large 12ct',1,1,5,'dairy','QR-EGGS-001',19,'Shelf 5','Aisle 3',7,'12 ct','12 count',TRUE,30,'active'),
('APPL-3LB','000000000015','Apples Gala 3lb bag',1,3,5,'produce','QR-APPL-001',28,'Shelf 1','Aisle 1',8,'3 lb','3 pounds',TRUE,14,'active'),
('CHED-1','000000000016','Cheddar Cheese Block',1,1,2,'dairy','QR-CHED-001',6,'Shelf 6','Aisle 3',7,'1 block','one block',TRUE,30,'active'),
('SAUCE-','000000000017','Pasta Sauce Marinara',3,8,5,'canned','QR-SAUCE-001',17,'Shelf 7','Aisle 5',3,'24 oz','24 ounces',FALSE,365,'active'),
('TP-12','000000000018','Toilet Paper 12 rolls',4,9,5,'personal care','QR-TP-001',13,'Shelf 3','Aisle 10',6,'12 ct','12 rolls',FALSE,365,'active');

-- product_vendor link rows
INSERT INTO product_vendor (product_id, supplier_id, vendor_sku, is_primary, cost, case_pack, lead_time_days, min_order_qty, active_flag)
SELECT p.product_id, p.supplier_id, p.qrcode, TRUE, 5.00, 12, 5, 1, TRUE
FROM products p;

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

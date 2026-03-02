-- Active: 1762822043374@@127.0.0.1@5432
INSERT INTO suppliers (email, phone_number) VALUES ('supplier@example.com', '123-456-7890');

INSERT INTO products (name, type, qrcode, quantity_in_store, shelf, aisle, supplier_id) 
VALUES ('Milk', 'diary', 'QR123', 10, 'Shelf 1', 'Aisle 3', 1);

INSERT INTO users (first_name, last_name, email, password, phone, role) VALUES 
('Alice Manager', 'Smith', 'alice.manager@example.com', 'password123', '555-0101', 'manager'),
('Bob Associate', 'Johnson', 'bob.associate@example.com', 'password456', '555-0102', 'associate'),
('Carol Associate', 'Brown', 'carol.associate@example.com', 'password457', '555-0104', 'associate'),
('David Associate', 'Davis', 'david.associate@example.com', 'password458', '555-0105', 'associate'),
('Charlie Customer', 'Williams', 'charlie.customer@example.com', 'password789', '555-0103', 'customer'),
('Emma Customer', 'Miller', 'emma.customer@example.com', 'password790', '555-0106', 'customer'),
('Frank Customer', 'Wilson', 'frank.customer@example.com', 'password791', '555-0107', 'customer'),
('Grace Customer', 'Moore', 'grace.customer@example.com', 'password792', '555-0108', 'customer');
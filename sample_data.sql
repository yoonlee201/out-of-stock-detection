-- Active: 1762822043374@@127.0.0.1@5432
INSERT INTO suppliers (email, phone_number) VALUES ('supplier@example.com', '123-456-7890');

INSERT INTO products (name, type, qrcode, quantity_in_store, shelf, aisle, supplier_id) 
VALUES ('Milk', 'diary', 'QR123', 10, 'Shelf 1', 'Aisle 3', 1);


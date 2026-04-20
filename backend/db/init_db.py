"""
Creates all tables and optionally seeds sample data.

Usage (inside the running backend container):
    python -m db.init_db            # create tables only
    python -m db.init_db --seed     # create tables + insert sample data

Via docker exec:
    docker exec oos_detection-backend python -m db.init_db
    docker exec oos_detection-backend python -m db.init_db --seed

Re-seeding is safe: skipped automatically when rows already exist.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow running directly from the repo root as well as inside the container
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app import create_app
from app.core.db import db
from app.models import Alerts, Employee, InventoryLogs, Products, Reorders, Suppliers, Users


def _seed(app):
    with app.app_context():
        if Users.query.count() > 0:
            print("Database already seeded — skipping.")
            return

        print("Seeding database...")

        # ------------------------------------------------------------------
        # Suppliers  (model fields: email, phone_number)
        # ------------------------------------------------------------------
        supplier_rows = [
            ("sysco@suppliers.com",          "800-555-0101"),
            ("usfoods@distro.com",           "888-555-0202"),
            ("kehe@distributors.net",        "877-555-0303"),
            ("cswholesale@supplyco.com",     "800-555-0404"),
            ("performancefood@group.com",    "866-555-0505"),
            ("unfi@naturalfoods.com",        "800-555-0606"),
            ("dairyfarmers@coop.com",        "855-555-0707"),
            ("freshpoint@produce.com",       "877-555-0808"),
            ("localmeat@regional.com",       "540-555-0912"),
        ]
        suppliers = [Suppliers(email=e, phone_number=p) for e, p in supplier_rows]
        db.session.add_all(suppliers)
        db.session.flush()
        s = {sup.email: sup for sup in suppliers}

        # ------------------------------------------------------------------
        # Products  (fields: name, type, qrcode, quantity_in_store, shelf, aisle, supplier_id)
        # ------------------------------------------------------------------
        product_rows = [
            ("Whole Milk 1gal",          "dairy",         "QR-MILK-001", 18, "Shelf 3",   "Aisle 3",  s["dairyfarmers@coop.com"].id),
            ("2% Reduced Fat Milk",      "dairy",         "QR-MILK-002", 12, "Shelf 3",   "Aisle 3",  s["dairyfarmers@coop.com"].id),
            ("Ground Beef 80/20",        "meat",          "QR-BEEF-001",  8, "Shelf 2",   "Aisle 7",  s["localmeat@regional.com"].id),
            ("Boneless Chicken Breast",  "meat",          "QR-CHKN-001", 22, "Shelf 1",   "Aisle 7",  s["localmeat@regional.com"].id),
            ("Bananas (bunch)",          "produce",       "QR-BANA-001", 45, "Shelf 1",   "Aisle 1",  s["freshpoint@produce.com"].id),
            ("Roma Tomatoes 1lb",        "produce",       "QR-TOMA-001", 14, "Shelf 2",   "Aisle 1",  s["freshpoint@produce.com"].id),
            ("Sourdough Bread",          "bakery",        "QR-BRED-001",  9, "Shelf 5",   "Aisle 2",  s["usfoods@distro.com"].id),
            ("Orange Juice 64oz",        "beverage",      "QR-OJ-001",   16, "Shelf 4",   "Aisle 4",  s["performancefood@group.com"].id),
            ("Frozen Pepperoni Pizza",   "frozen",        "QR-PIZA-001",  7, "Freezer 2", "Aisle 8",  s["performancefood@group.com"].id),
            ("Classic Potato Chips",     "snacks",        "QR-CHIP-001", 31, "Shelf 4",   "Aisle 6",  s["cswholesale@supplyco.com"].id),
            ("Tomato Soup 10.75oz",      "canned",        "QR-SOUP-001", 24, "Shelf 6",   "Aisle 5",  s["kehe@distributors.net"].id),
            ("Shampoo 13oz",             "personal care", "QR-SHMP-001", 11, "Shelf 1",   "Aisle 9",  s["unfi@naturalfoods.com"].id),
            ("Greek Yogurt Plain",       "dairy",         "QR-YOGT-001",  5, "Shelf 4",   "Aisle 3",  s["dairyfarmers@coop.com"].id),
            ("Eggs Large 12ct",          "dairy",         "QR-EGGS-001", 19, "Shelf 5",   "Aisle 3",  s["dairyfarmers@coop.com"].id),
            ("Apples Gala 3lb bag",      "produce",       "QR-APPL-001", 28, "Shelf 1",   "Aisle 1",  s["freshpoint@produce.com"].id),
            ("Cheddar Cheese Block",     "dairy",         "QR-CHED-001",  6, "Shelf 6",   "Aisle 3",  s["dairyfarmers@coop.com"].id),
            ("Pasta Sauce Marinara",     "canned",        "QR-SAUCE-001",17, "Shelf 7",   "Aisle 5",  s["kehe@distributors.net"].id),
            ("Toilet Paper 12 rolls",    "personal care", "QR-TP-001",   13, "Shelf 3",   "Aisle 10", s["unfi@naturalfoods.com"].id),
        ]
        products = [
            Products(name=n, type=t, qrcode=qr, quantity_in_store=qty,
                     shelf=shelf, aisle=aisle, supplier_id=sid)
            for n, t, qr, qty, shelf, aisle, sid in product_rows
        ]
        db.session.add_all(products)
        db.session.flush()
        p = {prod.qrcode: prod for prod in products}

        # ------------------------------------------------------------------
        # Users  (password hash = bcrypt("12345678"))
        # ------------------------------------------------------------------
        PW = "$2b$12$qxFtD4XimVariBfiA15hY.3JjTy3uGITru14f54XUIB7V2xmoUX1u"
        user_rows = [
            ("Maria",   "Gonzalez", "703-555-0123", "supervisor", "one@example.com",          True),
            ("James",   "Carter",   "757-555-0198", "manager",    "james.carter@mccs.mil",    True),
            ("Michael", "Lee",      "804-555-0765", "manager",    "michael.lee@mccs.mil",     True),
            ("Sarah",   "Johnson",  "540-555-0341", "associate",  "sarah.j@mccs.mil",         True),
            ("Robert",  "Wilson",   "202-555-1123", "associate",  "robert.w@mccs.mil",        True),
            ("Linda",   "Martinez", "301-555-1456", "associate",  "linda.m@mccs.mil",         True),
            ("Emily",   "Davis",    "571-555-0882", "customer",   "emily.davis@email.com",    True),
            ("David",   "Brown",    "703-555-1678", "customer",   "david.brown@email.com",    True),
            ("Jessica", "Taylor",   "540-555-1890", "customer",   "jessica.t@email.com",      False),
            ("Kevin",   "Anderson", "757-555-2034", "customer",   "kevin.anderson@email.com", True),
        ]
        users = [
            Users(first_name=fn, last_name=ln, phone=ph, role=role,
                  email=email, is_verified=verified, password=PW)
            for fn, ln, ph, role, email, verified in user_rows
        ]
        db.session.add_all(users)
        db.session.flush()
        u = {usr.email: usr for usr in users}

        # Employees
        employee_emails = [
            "one@example.com", "james.carter@mccs.mil", "michael.lee@mccs.mil",
            "sarah.j@mccs.mil", "robert.w@mccs.mil", "linda.m@mccs.mil",
        ]
        db.session.add_all([
            Employee(user_id=u[e].user_id, status="active") for e in employee_emails
        ])

        # ------------------------------------------------------------------
        # Alerts
        # ------------------------------------------------------------------
        now = datetime.now(timezone.utc)
        db.session.add_all([
            Alerts(user_id=u["one@example.com"].user_id,          product_id=p["QR-MILK-001"].product_id, alert_type="low_stock",    sent_time=now - timedelta(hours=2)),
            Alerts(user_id=u["james.carter@mccs.mil"].user_id,    product_id=p["QR-BEEF-001"].product_id, alert_type="out_of_stock", sent_time=now - timedelta(minutes=45)),
            Alerts(user_id=u["michael.lee@mccs.mil"].user_id,     product_id=p["QR-BANA-001"].product_id, alert_type="low_stock",    sent_time=now - timedelta(days=1)),
            Alerts(user_id=u["sarah.j@mccs.mil"].user_id,         product_id=p["QR-PIZA-001"].product_id, alert_type="out_of_stock", sent_time=now - timedelta(hours=3)),
            Alerts(user_id=u["robert.w@mccs.mil"].user_id,        product_id=p["QR-CHIP-001"].product_id, alert_type="low_stock",    sent_time=now - timedelta(minutes=30)),
            Alerts(user_id=u["emily.davis@email.com"].user_id,    product_id=p["QR-YOGT-001"].product_id, alert_type="out_of_stock", sent_time=now - timedelta(minutes=90)),
            Alerts(user_id=u["one@example.com"].user_id,          product_id=p["QR-EGGS-001"].product_id, alert_type="low_stock",    sent_time=now - timedelta(hours=4)),
            Alerts(user_id=u["james.carter@mccs.mil"].user_id,    product_id=p["QR-MILK-002"].product_id, alert_type="low_stock",    sent_time=now - timedelta(hours=1)),
            Alerts(user_id=u["michael.lee@mccs.mil"].user_id,     product_id=p["QR-OJ-001"].product_id,   alert_type="out_of_stock", sent_time=now - timedelta(days=2)),
            Alerts(user_id=u["linda.m@mccs.mil"].user_id,         product_id=p["QR-CHED-001"].product_id, alert_type="low_stock",    sent_time=now),
        ])

        # ------------------------------------------------------------------
        # Reorders
        # ------------------------------------------------------------------
        db.session.add_all([
            Reorders(user_id=u["one@example.com"].user_id,          product_id=p["QR-MILK-001"].product_id, quantity=48),
            Reorders(user_id=u["emily.davis@email.com"].user_id,    product_id=p["QR-BEEF-001"].product_id, quantity=60),
            Reorders(user_id=u["james.carter@mccs.mil"].user_id,    product_id=p["QR-PIZA-001"].product_id, quantity=36),
            Reorders(user_id=u["one@example.com"].user_id,          product_id=p["QR-YOGT-001"].product_id, quantity=24),
            Reorders(user_id=u["sarah.j@mccs.mil"].user_id,         product_id=p["QR-BANA-001"].product_id, quantity=72),
            Reorders(user_id=u["robert.w@mccs.mil"].user_id,        product_id=p["QR-CHIP-001"].product_id, quantity=48),
            Reorders(user_id=u["emily.davis@email.com"].user_id,    product_id=p["QR-EGGS-001"].product_id, quantity=30),
        ])

        # ------------------------------------------------------------------
        # Inventory logs
        # ------------------------------------------------------------------
        db.session.add_all([
            InventoryLogs(product_id=p["QR-MILK-001"].product_id, change_type="sale",             quantity_changed=-6),
            InventoryLogs(product_id=p["QR-MILK-001"].product_id, change_type="restock",          quantity_changed=48),
            InventoryLogs(product_id=p["QR-BEEF-001"].product_id, change_type="sale",             quantity_changed=-12),
            InventoryLogs(product_id=p["QR-BANA-001"].product_id, change_type="sale",             quantity_changed=-18),
            InventoryLogs(product_id=p["QR-PIZA-001"].product_id, change_type="damage",           quantity_changed=-4),
            InventoryLogs(product_id=p["QR-CHIP-001"].product_id, change_type="restock",          quantity_changed=36),
            InventoryLogs(product_id=p["QR-YOGT-001"].product_id, change_type="sale",             quantity_changed=-8),
            InventoryLogs(product_id=p["QR-EGGS-001"].product_id, change_type="reorder_received", quantity_changed=24),
            InventoryLogs(product_id=p["QR-MILK-002"].product_id, change_type="sale",             quantity_changed=-5),
            InventoryLogs(product_id=p["QR-OJ-001"].product_id,   change_type="sale",             quantity_changed=-10),
        ])

        db.session.commit()
        print("Seeding complete.")


def main():
    parser = argparse.ArgumentParser(description="Initialize the database.")
    parser.add_argument("--seed", action="store_true", help="Insert sample data after creating tables.")
    args = parser.parse_args()

    app = create_app()

    if args.seed:
        _seed(app)
    else:
        print("Tables created. Run with --seed to insert sample data.")


if __name__ == "__main__":
    main()

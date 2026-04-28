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

import bcrypt

# Allow running directly from the repo root as well as inside the container
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app import create_app
from app.core.db import db
from app.models import Alerts, Employee, InventoryLogs, Products, Reorders, Suppliers, Users

# Note: We intentionally use the same sample data for both Employees and Customers to simplify testing with different roles. In a real application, these would likely be separate sets of users with distinct attributes and permissions.
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
            ("sysco@suppliers.com",          "8005550101"),
            ("usfoods@distro.com",           "8885550202"),
            ("kehe@distributors.net",        "8775550303"),
            ("cswholesale@supplyco.com",     "8005550404"),
            ("performancefood@group.com",    "8665550505"),
            ("unfi@naturalfoods.com",        "8005550606"),
            ("dairyfarmers@coop.com",        "8555550707"),
            ("freshpoint@produce.com",       "8775550808"),
            ("localmeat@regional.com",       "5405550912"),
        ]
        suppliers = [Suppliers(email=e, phone_number=p) for e, p in supplier_rows]
        db.session.add_all(suppliers)
        db.session.flush()
        s = {sup.email: sup for sup in suppliers}

        # ------------------------------------------------------------------
        # Products  (fields: name, brand, variant, size, type, qrcode,
        #            quantity_in_store, shelf, aisle, supplier_id)
        # ------------------------------------------------------------------
        product_rows = [
            # name                    brand                variant               size         type             qrcode          qty  shelf aisle  supplier
            ("Whole Milk",            "Organic Valley",    "Whole",              "1 gal",     "dairy",         "QR-MILK-001",  18,   "3",  "3",  s["dairyfarmers@coop.com"].id),
            ("Reduced Fat Milk",      "Horizon",           "2% Reduced Fat",     "1 gal",     "dairy",         "QR-MILK-002",  12,   "3",  "3",  s["dairyfarmers@coop.com"].id),
            ("Ground Beef",           "Local Farm",        "80/20",              "1 lb",      "meat",          "QR-BEEF-001",   8,   "2",  "7",  s["localmeat@regional.com"].id),
            ("Chicken Breast",        "Tyson",             "Boneless Skinless",  "2 lb",      "meat",          "QR-CHKN-001",  22,   "1",  "7",  s["localmeat@regional.com"].id),
            ("Bananas",               "Dole",              "Yellow",             "Bunch",     "produce",       "QR-BANA-001",  45,   "1",  "1",  s["freshpoint@produce.com"].id),
            ("Roma Tomatoes",         "Local Farm",        "Roma",               "1 lb",      "produce",       "QR-TOMA-001",  14,   "2",  "1",  s["freshpoint@produce.com"].id),
            ("Sourdough Bread",       "Pepperidge Farm",   "Classic",            "24 oz",     "bakery",        "QR-BRED-001",   9,   "5",  "2",  s["usfoods@distro.com"].id),
            ("Orange Juice",          "Tropicana",         "Original No Pulp",   "64 oz",     "beverage",      "QR-OJ-001",    16,   "4",  "4",  s["performancefood@group.com"].id),
            ("Pepperoni Pizza",       "DiGiorno",          "Rising Crust",       "28.2 oz",   "frozen",        "QR-PIZA-001",   7,   "2",  "8",  s["performancefood@group.com"].id),
            ("Potato Chips",          "Lay's",             "Classic",            "8 oz",      "snacks",        "QR-CHIP-001",  31,   "4",  "6",  s["cswholesale@supplyco.com"].id),
            ("Tomato Soup",           "Campbell's",        "Classic",            "10.75 oz",  "canned",        "QR-SOUP-001",  24,   "6",  "5",  s["kehe@distributors.net"].id),
            ("Shampoo",               "Head & Shoulders",  "Classic Clean",      "13.5 oz",   "personal care", "QR-SHMP-001",  11,   "1",  "9",  s["unfi@naturalfoods.com"].id),
            ("Greek Yogurt",          "Chobani",           "Plain",              "32 oz",     "dairy",         "QR-YOGT-001",   5,   "4",  "3",  s["dairyfarmers@coop.com"].id),
            ("Large Eggs",            "Eggland's Best",    "Grade A",            "12 ct",     "dairy",         "QR-EGGS-001",  19,   "5",  "3",  s["dairyfarmers@coop.com"].id),
            ("Gala Apples",           "Local Farm",        "Gala",               "3 lb bag",  "produce",       "QR-APPL-001",  28,   "1",  "1",  s["freshpoint@produce.com"].id),
            ("Cheddar Cheese",        "Tillamook",         "Sharp",              "16 oz",     "dairy",         "QR-CHED-001",   6,   "6",  "3",  s["dairyfarmers@coop.com"].id),
            ("Pasta Sauce",           "Rao's",             "Marinara",           "24 oz",     "canned",        "QR-SAUCE-001", 17,   "7",  "5",  s["kehe@distributors.net"].id),
            ("Toilet Paper",          "Charmin",           "Ultra Soft",         "12 rolls",  "personal care", "QR-TP-001",    13,   "3",  "10", s["unfi@naturalfoods.com"].id),
        ]
        products = [
            Products(name=n, brand=brand, variant=variant, size=size,
                     type=t, qrcode=qr, quantity_in_store=qty,
                     shelf=shelf, aisle=aisle, supplier_id=sid)
            for n, brand, variant, size, t, qr, qty, shelf, aisle, sid in product_rows
        ]
        db.session.add_all(products)
        db.session.flush()
        p = {prod.qrcode: prod for prod in products}

        # ------------------------------------------------------------------
        # Users  (password hash = bcrypt("12345678"))
        # ------------------------------------------------------------------
        PW = bcrypt.hashpw("12345678".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_rows = [
            ("Maria",   "Gonzalez", "7035550123", "verizon", "supervisor", "one@example.com",          True),
            ("James",   "Carter",   "7575550198", "verizon", "manager",    "james.carter@mccs.mil",    True),
            ("Michael", "Lee",      "8045550765", "verizon", "manager",    "michael.lee@mccs.mil",     True),
            ("Sarah",   "Johnson",  "5405550341", "verizon", "associate",  "sarah.j@mccs.mil",         True),
            ("Robert",  "Wilson",   "2025551123", "verizon", "associate",  "robert.w@mccs.mil",        True),
            ("Linda",   "Martinez", "3015551456", "verizon", "associate",  "linda.m@mccs.mil",         True),
            ("Emily",   "Davis",    "5715550882", "verizon",  "customer",   "emily.davis@email.com",    True),
            ("David",   "Brown",    "7035551678", "verizon",  "customer",   "david.brown@email.com",    True),
            ("Jessica", "Taylor",   "5405551890", "verizon",  "customer",   "jessica.t@email.com",      False),
            ("Kevin$",   "Anderson", "7575552034", "verizon",  "customer",   "kevin.anderson@email.com", True),
        ]
        users = [
            Users(first_name=fn, last_name=ln, phone=ph, carrier=carrier, role=role,
                  email=email, is_verified=verified, password=PW)
            for fn, ln, ph, carrier, role, email, verified in user_rows
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
            Employee(user_id=u[e].user_id, status="inactive") for e in employee_emails
        ])

        db.session.commit()


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

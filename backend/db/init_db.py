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
        # Names/brands/variants must match planogram slots exactly so that
        # alert_services._resolve_product can find the row when a scan runs.
        # See shelf_analyzer/data/planograms/cereal_aisle_main.json.
        # Initial quantity_in_store = sum of planogram facings for that SKU; the
        # scanner overwrites it via update_shelf_status_from_detections.
        product_rows = [
            # name                       brand            variant         size       type      qrcode             qty  shelf aisle  supplier
            ("Chex",                     "General Mills", "Blueberry",    "14 oz",   "cereal", "QR-CHEX-BLUE",      8,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Chex",                     "General Mills", "Cinnamon",     "14 oz",   "cereal", "QR-CHEX-CINN",     10,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Chex",                     "General Mills", "Honey Nut",    "14 oz",   "cereal", "QR-CHEX-HONY",     24,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Chex",                     "General Mills", "Original",     "14 oz",   "cereal", "QR-CHEX-ORIG",     15,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Chex",                     "General Mills", "Wheat",        "14 oz",   "cereal", "QR-CHEX-WHET",     18,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Crispix",                  "Kellogg's",     "Original",     "12 oz",   "cereal", "QR-CRSP-ORIG",     22,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Wheaties",                 "General Mills", "Original",     "15.6 oz", "cereal", "QR-WHTY-ORIG",     14,  "1",  "5",  s["kehe@distributors.net"].id),
            ("Rice Chex",                "General Mills", "Original",     "12 oz",   "cereal", "QR-RICE-ORIG",     20,  "2",  "5",  s["kehe@distributors.net"].id),
            ("Rice Squares",             "Great Value",   "Original",     "14 oz",   "cereal", "QR-RSQR-ORIG",     14,  "2",  "5",  s["cswholesale@supplyco.com"].id),
            ("Corn Chex",                "General Mills", "Original",     "12 oz",   "cereal", "QR-CORN-ORIG",     59,  "2",  "5",  s["kehe@distributors.net"].id),
            ("Cheerios",                 "General Mills", "Oat Crunch",   "14 oz",   "cereal", "QR-CHRO-OATC",     86,  "2",  "5",  s["kehe@distributors.net"].id),
            ("Cheerios",                 "General Mills", "Original",     "12 oz",   "cereal", "QR-CHRO-ORIG",     34,  "4",  "5",  s["kehe@distributors.net"].id),
            ("Maple Cheerios",           "General Mills", "Maple",        "12 oz",   "cereal", "QR-MAPL-ORIG",     16,  "2",  "5",  s["kehe@distributors.net"].id),
            ("Toasted O's",              "Great Value",   "Original",     "12 oz",   "cereal", "QR-TOAS-ORIG",     24,  "2",  "5",  s["cswholesale@supplyco.com"].id),
            ("Rice Krispies",            "Kellogg's",     "Original",     "12 oz",   "cereal", "QR-KRSP-ORIG",     28,  "3",  "5",  s["kehe@distributors.net"].id),
            ("Multi Grain Cheerios",     "General Mills", "Multi Grain",  "12 oz",   "cereal", "QR-MGRN-ORIG",     18,  "3",  "5",  s["kehe@distributors.net"].id),
            ("Cap'n Crunch",             "Quaker",        "Original",     "14 oz",   "cereal", "QR-CAPN-ORIG",     52,  "3",  "5",  s["unfi@naturalfoods.com"].id),
            ("Life",                     "Quaker",        "Original",     "13 oz",   "cereal", "QR-LIFE-ORIG",     75,  "4",  "5",  s["unfi@naturalfoods.com"].id),
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

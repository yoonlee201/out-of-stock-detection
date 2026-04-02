import os
import psycopg2
from psycopg2 import sql

DB_PARAMS = {
    'dbname': os.getenv('DB_NAME', 'shelf_monitor_db'),
    'user': os.getenv('DB_USER', 'your_db_user'),
    'password': os.getenv('DB_PASSWORD', 'your_db_password'),
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
}


def _connect():
    return psycopg2.connect(**DB_PARAMS)


def query_db(query, params=None, fetchall=True):
    """Run a SQL query and return results."""
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            if fetchall:
                return cur.fetchall()
            return cur.rowcount
    finally:
        conn.commit()
        conn.close()


def get_product_by_name(product_name):
    query = sql.SQL(
        """
        SELECT product_id, name, type, qrcode, quantity_in_store, shelf, aisle, supplier_id
        FROM products
        WHERE LOWER(name) = LOWER(%s)
        """
    )
    results = query_db(query, (product_name,))
    if not results:
        return None
    row = results[0]
    return {
        'product_id': row[0],
        'name': row[1],
        'type': row[2],
        'qrcode': row[3],
        'quantity_in_store': row[4],
        'shelf': row[5],
        'aisle': row[6],
        'supplier_id': row[7],
    }


def get_products_by_location(shelf=None, aisle=None):
    if shelf and aisle:
        query = sql.SQL("SELECT product_id, name, quantity_in_store, shelf, aisle FROM products WHERE shelf = %s AND aisle = %s")
        params = (shelf, aisle)
    elif shelf:
        query = sql.SQL("SELECT product_id, name, quantity_in_store, shelf, aisle FROM products WHERE shelf = %s")
        params = (shelf,)
    elif aisle:
        query = sql.SQL("SELECT product_id, name, quantity_in_store, shelf, aisle FROM products WHERE aisle = %s")
        params = (aisle,)
    else:
        query = sql.SQL("SELECT product_id, name, quantity_in_store, shelf, aisle FROM products")
        params = ()
    rows = query_db(query, params)
    return [
        {'product_id': r[0], 'name': r[1], 'quantity_in_store': r[2], 'shelf': r[3], 'aisle': r[4]}
        for r in rows
    ]


def get_supplier_by_id(supplier_id):
    query = sql.SQL("SELECT supplier_id, supplier_code, supplier_name, email, phone_number FROM suppliers WHERE supplier_id = %s")
    rows = query_db(query, (supplier_id,))
    if not rows:
        return None
    r = rows[0]
    return {
        'supplier_id': r[0],
        'supplier_code': r[1],
        'supplier_name': r[2],
        'email': r[3],
        'phone_number': r[4],
    }


def get_employee_by_user_id(user_id):
    query = sql.SQL(
        "SELECT e.user_id, u.first_name, u.last_name, u.role, e.status FROM employee e JOIN users u ON e.user_id = u.user_id WHERE e.user_id = %s"
    )
    rows = query_db(query, (user_id,))
    if not rows:
        return None
    r = rows[0]
    return {
        'user_id': r[0],
        'first_name': r[1],
        'last_name': r[2],
        'role': r[3],
        'status': r[4],
    }


def insert_reorder(user_id, product_id, quantity):
    query = sql.SQL(
        "INSERT INTO reorders (user_id, product_id, quantity, created_time) VALUES (%s, %s, %s, NOW()) RETURNING reorder_id"
    )
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (user_id, product_id, quantity))
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
    finally:
        conn.close()


def insert_alert(user_id, product_id, alert_type):
    query = sql.SQL(
        "INSERT INTO alerts (user_id, product_id, alert_type, sent_time) VALUES (%s, %s, %s, NOW()) RETURNING id"
    )
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (user_id, product_id, alert_type))
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
    finally:
        conn.close()


def update_product_quantity(product_id, quantity):
    query = sql.SQL("UPDATE products SET quantity_in_store = %s WHERE product_id = %s")
    rows_affected = query_db(query, (quantity, product_id), fetchall=False)
    return rows_affected


def log_inventory_change(product_id, change_type, quantity_changed):
    query = sql.SQL(
        "INSERT INTO inventory_logs (product_id, change_type, quantity_changed, timestamp) VALUES (%s, %s, %s, NOW()) RETURNING id"
    )
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (product_id, change_type, quantity_changed))
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
    finally:
        conn.close()

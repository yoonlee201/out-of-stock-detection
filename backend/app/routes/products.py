from flask import Blueprint, jsonify
from app.core.db import db
from sqlalchemy import text

products_blueprint = Blueprint("products", __name__)

@products_blueprint.route("/", methods=["GET"])
def get_products():
    try:
        result = db.session.execute(text("SELECT * FROM products"))
        rows = result.fetchall()

        products = []
        for row in rows:
            products.append({
                "id": row.id,
                "name": row.name,
                "type": row.type,
                "quantity": row.quantity,
                "aisle": row.aisle,
                "shelf": row.shelf,
            })

        return jsonify(products), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
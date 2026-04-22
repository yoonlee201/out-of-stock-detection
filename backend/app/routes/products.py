from flask import Blueprint, jsonify, request
from app.core.db import db
from app.models import Products, Suppliers
from app.util.auth import require_active_employee

products_blueprint = Blueprint("products", __name__)


def _serialize(product: Products) -> dict:
    return {
        "product_id": product.product_id,
        "name": product.name,
        "brand": product.brand or "",
        "variant": product.variant or "",
        "size": product.size or "",
        "type": product.type,
        "qrcode": product.qrcode,
        "quantity_in_store": product.quantity_in_store,
        "shelf": product.shelf,
        "aisle": product.aisle,
        "supplier_id": product.supplier_id,
        "shelf_status": product.shelf_status or "unknown",
        "last_checked": product.last_checked.isoformat() if product.last_checked else None,
    }


@products_blueprint.route("/", methods=["GET"])
def get_products():
    search = request.args.get("search", "").strip()
    query = Products.query
    if search:
        query = query.filter(
            db.or_(
                Products.name.ilike(f"%{search}%"),
                Products.brand.ilike(f"%{search}%"),
            )
        )
    products = query.order_by(Products.product_id.asc()).all()
    return jsonify([_serialize(p) for p in products]), 200


@products_blueprint.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    product = Products.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(_serialize(product)), 200


@products_blueprint.route("/<int:product_id>", methods=["PATCH", "OPTIONS"])
@require_active_employee
def update_product(product_id, session):
    if request.method == "OPTIONS":
        return "", 204

    product = Products.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    body = request.get_json(silent=True) or {}

    if "name" in body:
        product.name = str(body["name"]).strip()
    if "brand" in body:
        product.brand = str(body["brand"]).strip()
    if "variant" in body:
        product.variant = str(body["variant"]).strip()
    if "size" in body:
        product.size = str(body["size"]).strip()
    if "type" in body:
        product.type = str(body["type"]).strip()
    if "quantity_in_store" in body:
        qty = int(body["quantity_in_store"])
        if qty < 0:
            return jsonify({"error": "quantity_in_store cannot be negative"}), 400
        product.quantity_in_store = qty

    db.session.commit()
    return jsonify({"message": "Product updated", "product": _serialize(product)}), 200


@products_blueprint.route("/<int:product_id>/supplier", methods=["GET"])
def get_product_supplier(product_id):
    product = Products.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    supplier = Suppliers.query.get(product.supplier_id)
    if not supplier:
        return jsonify({"error": "Supplier not found"}), 404

    return jsonify({
        "product_id": product.product_id,
        "supplier": {
            "id": supplier.id,
            "email": supplier.email,
            "phone_number": supplier.phone_number,
        }
    }), 200

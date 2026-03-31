from flask import Blueprint, jsonify, request
from app.models import Products, Suppliers

products_blueprint = Blueprint("products", __name__)


@products_blueprint.route("/", methods=["GET"])
def get_products():
    search = request.args.get("search", "").strip()

    query = Products.query

    if search:
        query = query.filter(Products.name.ilike(f"%{search}%"))

    products = query.order_by(Products.product_id.asc()).all()

    result = []
    for product in products:
        result.append({
            "product_id": product.product_id,
            "name": product.name,
            "type": product.type,
            "qrcode": product.qrcode,
            "quantity_in_store": product.quantity_in_store,
            "shelf": product.shelf,
            "aisle": product.aisle,
            "supplier_id": product.supplier_id,
        })

    return jsonify(result), 200


@products_blueprint.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    product = Products.query.get(product_id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    result = {
        "product_id": product.product_id,
        "name": product.name,
        "type": product.type,
        "qrcode": product.qrcode,
        "quantity_in_store": product.quantity_in_store,
        "shelf": product.shelf,
        "aisle": product.aisle,
        "supplier_id": product.supplier_id,
    }

    return jsonify(result), 200


@products_blueprint.route("/<int:product_id>/supplier", methods=["GET"])
def get_product_supplier(product_id):
    product = Products.query.get(product_id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    supplier = Suppliers.query.get(product.supplier_id)

    if not supplier:
        return jsonify({"error": "Supplier not found"}), 404

    result = {
        "product_id": product.product_id,
        "supplier": {
            "id": supplier.id,
            "email": supplier.email,
            "phone_number": supplier.phone_number,
        }
    }

    return jsonify(result), 200
from flask import Blueprint, jsonify, request
from app.core.db import db
from app.models import ProductLocations, Products, Suppliers
from app.util.auth import require_active_employee

products_blueprint = Blueprint("products", __name__)


def _serialize(product: Products) -> dict:
    locations = sorted(
        product.locations or [],
        key=lambda loc: (loc.shelf, loc.position),
    )
    return {
        "product_id": product.product_id,
        "name": product.name,
        "brand": product.brand or "",
        "variant": product.variant or "",
        "size": product.size or "",
        "type": product.type,
        "qrcode": product.qrcode,
        "quantity_in_store": product.quantity_in_store,
        "original_quantity": product.original_quantity or product.quantity_in_store,
        "shelf": product.shelf,
        "aisle": product.aisle,
        "supplier_id": product.supplier_id,
        "shelf_status": product.shelf_status or "unknown",
        "last_checked": product.last_checked.isoformat() if product.last_checked else None,
        "locations": [
            {
                "slot_id": loc.slot_id,
                "shelf": loc.shelf,
                "position": loc.position,
                "planogram_quantity": loc.planogram_quantity,
                "shelf_status": loc.shelf_status or "unknown",
                "last_checked": loc.last_checked.isoformat() if loc.last_checked else None,
            }
            for loc in locations
        ],
    }


@products_blueprint.route("/", methods=["POST", "OPTIONS"])
@require_active_employee
def create_product(session):
    if request.method == "OPTIONS":
        return "", 204

    body = request.get_json(silent=True) or {}

    name = str(body.get("name", "")).strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        quantity = int(body.get("quantity_in_store", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "quantity_in_store must be a number"}), 400
    if quantity < 0:
        return jsonify({"error": "quantity_in_store cannot be negative"}), 400

    supplier_id = body.get("supplier_id")
    if supplier_id is None:
        first_supplier = Suppliers.query.order_by(Suppliers.id.asc()).first()
        if not first_supplier:
            return jsonify({"error": "No supplier exists — create one first"}), 400
        supplier_id = first_supplier.id

    qrcode = str(body.get("qrcode", "")).strip()
    base = qrcode or f"QR-{name.upper().replace(' ', '-')[:16]}"
    if not qrcode or Products.query.filter_by(qrcode=qrcode).first():
        i = 1
        while Products.query.filter_by(qrcode=f"{base}-{i}").first():
            i += 1
        qrcode = f"{base}-{i}"

    product = Products(
        name=name,
        brand=str(body.get("brand", "")).strip(),
        variant=str(body.get("variant", "")).strip(),
        size=str(body.get("size", "")).strip(),
        type=str(body.get("type", "")).strip() or "general",
        qrcode=qrcode,
        quantity_in_store=quantity,
        original_quantity=quantity,
        shelf=str(body.get("shelf", "")).strip() or "S11",
        aisle=str(body.get("aisle", "")).strip() or "A1",
        supplier_id=supplier_id,
    )

    db.session.add(product)
    db.session.flush()  # assign product_id before creating locations

    raw_positions = body.get("positions", [])
    if isinstance(raw_positions, list):
        positions = [int(p) for p in raw_positions if str(p).strip().isdigit()]
        shelves = [s.strip() for s in product.shelf.split(",") if s.strip()]
        for shelf_val in shelves:
            for pos in positions:
                slot_id = f"R{shelf_val}-P{pos}"
                if not ProductLocations.query.filter_by(slot_id=slot_id).first():
                    db.session.add(ProductLocations(
                        product_id=product.product_id,
                        slot_id=slot_id,
                        shelf=shelf_val,
                        position=pos,
                        planogram_quantity=1,
                    ))

    db.session.commit()
    return jsonify({"message": "Product created", "product": _serialize(product)}), 201


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
    if "aisle" in body:
        product.aisle = str(body["aisle"]).strip()
    if "shelf" in body:
        product.shelf = str(body["shelf"]).strip()

    db.session.commit()
    return jsonify({"message": "Product updated", "product": _serialize(product)}), 200


@products_blueprint.route("/<int:product_id>", methods=["DELETE", "OPTIONS"])
@require_active_employee
def delete_product(product_id, session):
    if request.method == "OPTIONS":
        return "", 204

    product = Products.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted", "product_id": product_id}), 200


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

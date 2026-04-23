from flask import Blueprint, jsonify, request
from app.core.db import db
from app.models import Products, Reorders
from app.util.auth import require_active_employee

reorders_blueprint = Blueprint("reorders", __name__)


@reorders_blueprint.route("/", methods=["POST", "OPTIONS"])
@require_active_employee
def create_reorder(session):
    if request.method == "OPTIONS":
        return "", 204

    body = request.get_json(silent=True) or {}
    product_id = body.get("product_id")
    quantity = body.get("quantity")

    if not product_id or not quantity:
        return jsonify({"error": "product_id and quantity are required"}), 400

    try:
        quantity = int(quantity)
        if quantity <= 0:
            return jsonify({"error": "quantity must be positive"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "quantity must be an integer"}), 400

    product = Products.query.get(int(product_id))
    if not product:
        return jsonify({"error": "Product not found"}), 404

    reorder = Reorders(
        user_id=session.user_id,
        product_id=product.product_id,
        quantity=quantity,
    )
    db.session.add(reorder)
    db.session.commit()

    return jsonify({
        "message": "Reorder created",
        "reorder": {
            "id": reorder.id,
            "product_id": reorder.product_id,
            "quantity": reorder.quantity,
            "created_at": reorder.created_at.isoformat(),
        }
    }), 201


@reorders_blueprint.route("/", methods=["GET"])
@require_active_employee
def list_reorders(session):
    reorders = (
        Reorders.query
        .order_by(Reorders.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify([
        {
            "id": r.id,
            "product_id": r.product_id,
            "quantity": r.quantity,
            "created_at": r.created_at.isoformat(),
        }
        for r in reorders
    ]), 200

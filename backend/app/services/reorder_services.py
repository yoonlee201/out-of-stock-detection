from app.core.db import db
from app.models import Products, Reorders
from app.services.user_services import get_all_active_employees


def get_low_stock_products(threshold=10):
    return Products.query.filter(Products.quantity_in_store < threshold).all()


def seed_mock_reorders(quantity=10):
    """
    Create Reorder rows for every low-stock product, assigned to the first active
    employee. Intended for development / demo use only.
    Returns a list of serialised reorder dicts.
    """
    products = get_low_stock_products()
    if not products:
        return []

    employees = get_all_active_employees()
    if not employees:
        return []

    user, _emp = employees[0]
    created = []

    for product in products:
        reorder = Reorders(user_id=user.user_id, product_id=product.product_id, quantity=quantity)
        db.session.add(reorder)
        db.session.flush()
        created.append({
            "id": reorder.id,
            "product_id": product.product_id,
            "quantity": quantity,
        })

    db.session.commit()
    return created

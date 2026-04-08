from app.services.product_services import get_low_stock_products
from app.models import Users
from agent.db_ops import insert_reorder


def create_mock_reorders():
    products = get_low_stock_products()
    if not products:
        print("No low stock products found for reorder.")
        return []

    test_employee = Users.query.filter_by(email='albertwang041006@gmail.com').first()
    if not test_employee:
        print("No test employee found.")
        return []

    created_reorders = []

    for product in products:
        try:
            reorder_quantity = 10
            reorder_id = insert_reorder(test_employee.user_id, product.product_id, reorder_quantity)
            print(f"Created reorder {reorder_id} for product {product.product_id}")
            created_reorders.append({
                "reorder_id": reorder_id,
                "product_id": product.product_id,
                "quantity": reorder_quantity
            })
        except Exception as e:
            print(f"Failed to create reorder for product {product.product_id}: {e}")

    return created_reorders
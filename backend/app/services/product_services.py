from app.models import Products

def get_product_by_id(product_id):
    return Products.query.filter(Products.id == product_id).first()

def get_low_stock_products(threshold=10):
    return Products.query.filter(Products.quantity_in_store < threshold).all()
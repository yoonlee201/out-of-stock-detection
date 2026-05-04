
from flask import Flask 
from flask_cors import CORS

from app.core.db import db

from .routes.default import default_blueprint
from .routes.users import users_blueprint
from .routes.products import products_blueprint
from .routes.shelf_analysis import shelf_analysis_blueprint
from .routes.alert import alert_blueprint

from app.core.config import config

def create_app():
    app = Flask(__name__)
    frontend_url = config.FRONTEND_URL #config.FRONTEND_URL or "http://localhost:5173"
    
    print("Allowed CORS origins:", frontend_url)
    CORS(app, resources={r"/*": {
        "origins": frontend_url}},
         allow_headers=["Content-Type", "Authorization"], 
         supports_credentials=True, 
         methods=["GET", "POST", "PUT", "DELETE", "PATCH","OPTIONS"])
    


    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    db.init_app(app)

    with app.app_context():
        db.create_all()

    # Pre-warm ML models in a background thread so they're ready before the first request
    import threading
    def _prewarm():
        try:
            from shelf_analyzer.infer import load_yolo_model
            from shelf_analyzer.sku_identifier import load_qwen_resources
            load_yolo_model()
            load_qwen_resources()
            print("ML models pre-warmed successfully.")
        except Exception as e:
            print(f"Model pre-warm failed (will load on first request): {e}")
    threading.Thread(target=_prewarm, daemon=True).start()

    prefix = "/api/v1" if config.check_production() else ""

    app.register_blueprint(default_blueprint, url_prefix=f"/")
    app.register_blueprint(users_blueprint, url_prefix=f"{prefix}/users")
    app.register_blueprint(products_blueprint, url_prefix=f"{prefix}/products")
    app.register_blueprint(shelf_analysis_blueprint, url_prefix=f"{prefix}/shelf-analysis")
    app.register_blueprint(alert_blueprint, url_prefix=f"{prefix}/alerts")

    return app

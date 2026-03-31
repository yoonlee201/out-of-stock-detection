
from flask import Flask 
from flask_cors import CORS

from app.core.db import db

from .routes.default import default_blueprint
from .routes.users import users_blueprint
from .routes.space_detection import space_detection_blueprint
from .routes.products import products_blueprint
from app.core.config import config

def create_app():
    app = Flask(__name__)
    frontend_url = [config.FRONTEND_URL, "127.0.0.1"] #config.FRONTEND_URL or "http://localhost:5173"
    
    print("Allowed CORS origins:", frontend_url)
    CORS(app, resources={r"/*": {
        "origins": frontend_url}},
         allow_headers=["Content-Type", "Authorization"], 
         supports_credentials=True, 
         methods=["GET", "POST", "PUT", "DELETE", "PATCH","OPTIONS"])
    


    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    db.init_app(app)
    
    prefix = "/api/v1" if config.check_production() else ""

    app.register_blueprint(default_blueprint, url_prefix=f"/")
    app.register_blueprint(users_blueprint, url_prefix=f"{prefix}/users")
    app.register_blueprint(space_detection_blueprint, url_prefix=f"{prefix}/space-detection")
    app.register_blueprint(products_blueprint, url_prefix=f"{prefix}/products")

    return app

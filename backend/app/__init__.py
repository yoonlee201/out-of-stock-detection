import os
from flask import Flask 
from dotenv import load_dotenv
from flask_cors import CORS

from app.core.db import db

from .routes.default import default_blueprint
from .routes.users import users_blueprint
from app.core.config import config
load_dotenv()

def create_app():
    app = Flask(__name__)
    frontend_url = ["http://localhost:5173", "127.0.0.1"] #config.FRONTEND_URL or "http://localhost:5173"
    
    
    if config.FRONTEND_URL != "":
        frontend_url.append(config.FRONTEND_URL)
    
    print("Allowed CORS origins:", frontend_url)
    CORS(app, resources={r"/*": {
        "origins": frontend_url}},
         allow_headers=["Content-Type", "Authorization"], 
         supports_credentials=True, 
         methods=["GET", "POST", "PUT", "DELETE", "PATCH","OPTIONS"])
    


    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI")
    db.init_app(app)
    
    prefix = "/api/v1" if os.getenv("FLASK_ENV") == "production" else ""

    app.register_blueprint(default_blueprint, url_prefix=f"/")
    app.register_blueprint(users_blueprint, url_prefix=f"{prefix}/users")

    return app
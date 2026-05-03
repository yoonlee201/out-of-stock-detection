from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_talisman import Talisman
from werkzeug.middleware.proxy_fix import ProxyFix

from app.core.db import db
from app.core.config import config

from .routes.default import default_blueprint
from .routes.users import users_blueprint
from .routes.products import products_blueprint
from .routes.shelf_analysis import shelf_analysis_blueprint
from .routes.alert import alert_blueprint
from .routes.reorders import reorders_blueprint


# CSP for a pure JSON API: no scripts, styles, or frames should ever be loaded
# from this origin. Tighten the connect-src once you know the exact frontend domain.
_API_CSP = {
    "default-src": "'none'",
    "frame-ancestors": "'none'",
}


def create_app() -> Flask:
    app = Flask(__name__)

    # Trust one proxy hop (Vercel → EC2).
    # This lets Flask see X-Forwarded-Proto: https from Vercel so Talisman
    # doesn't redirect those requests to HTTPS again (they're already HTTPS).
    if config.PRODUCTION:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # ── Security headers (Flask-Talisman) ─────────────────────────────────────
    # force_https redirects HTTP → HTTPS in production.
    # In local dev (PRODUCTION=False) HTTPS is not available, so it is disabled.
    Talisman(
        app,
        force_https=False,           # SSL is terminated at Vercel; EC2 only speaks HTTP
        strict_transport_security=False,  # HSTS only meaningful at the TLS-terminating edge
        strict_transport_security_max_age=31536000,
        strict_transport_security_include_subdomains=True,
        content_security_policy=_API_CSP,
        referrer_policy="strict-origin-when-cross-origin",
        x_content_type_options=True,
        x_xss_protection=False,   # deprecated header; modern browsers ignore it
        frame_options="DENY",
        frame_options_allow_from=None,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    allowed_origins = [o.strip() for o in config.FRONTEND_URL.split(",") if o.strip()]
    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    )
    
    app.url_map.strict_slashes = False

    # ── Database ──────────────────────────────────────────────────────────────
    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    Migrate(app, db)

    with app.app_context():
        db.create_all()

    # ── Routes ────────────────────────────────────────────────────────────────
    prefix = "/api/v1" if config.check_production() else ""

    app.register_blueprint(default_blueprint,        url_prefix="/")
    app.register_blueprint(users_blueprint,          url_prefix=f"{prefix}/users")
    app.register_blueprint(products_blueprint,       url_prefix=f"{prefix}/products")
    app.register_blueprint(shelf_analysis_blueprint, url_prefix=f"{prefix}/shelf-analysis")
    app.register_blueprint(alert_blueprint,          url_prefix=f"{prefix}/alerts")
    app.register_blueprint(reorders_blueprint,       url_prefix=f"{prefix}/reorders")

    return app

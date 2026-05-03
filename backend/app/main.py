import sys
from app import create_app
from app.core.config import config

app = create_app()

if __name__ == "__main__":
    if config.PRODUCTION:
        # Flask's built-in server is single-threaded and not hardened.
        # In production always use Gunicorn:
        #   gunicorn "app.main:app" --bind 0.0.0.0:5000 --workers 2 --timeout 120
        # The docker-compose.yml CMD already does this — do not run this file directly.
        print(
            "ERROR: Do not run app.main directly in production. "
            "Use Gunicorn (see docker-compose.yml CMD).",
            file=sys.stderr,
        )
        sys.exit(1)

    app.run(host="0.0.0.0", port=config.BACKEND_PORT, debug=True)

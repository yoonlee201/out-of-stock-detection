from app import create_app
from app.core.config import config

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.BACKEND_PORT, debug=True)
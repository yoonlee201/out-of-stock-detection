from .settings import settings


class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = settings.SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_URL = settings.FRONTEND_URL
    BACKEND_PORT = settings.BACKEND_PORT

    OPENAI_API_KEY = settings.OPENAI_API_KEY
    OPENAI_API_BASE = settings.OPENAI_API_BASE
    OPENAI_MODEL = settings.OPENAI_MODEL

    # Alerting
    GMAIL_ADDRESS = settings.GMAIL_ADDRESS
    GMAIL_PASSWORD = settings.GMAIL_PASSWORD
    IPQS_API_KEY = settings.IPQS_API_KEY

    SECRET_KEY = settings.SECRET_KEY
    INVITATION_SECRET_KEY = settings.INVITATION_SECRET_KEY or settings.SECRET_KEY

    PRODUCTION: bool = settings.PRODUCTION

    def check_production(self) -> bool:
        return self.PRODUCTION


config = Config()

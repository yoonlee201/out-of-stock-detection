# app/config.py
from .settings import settings

class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = settings.SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Google OAuth
    GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
    GOOGLE_REDIRECT_URI = settings.GOOGLE_REDIRECT_URI

    # Google Drive scopes
    GOOGLE_SCOPES = settings.GOOGLE_SCOPES
    
    FRONTEND_URL = settings.FRONTEND_URL
    
    OPENAI_API_KEY = settings.OPENAI_API_KEY
    OPENAI_MODEL = settings.OPENAI_MODEL

config = Config()
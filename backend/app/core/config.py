# app/config.py
from .settings import settings

class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = settings.SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    FRONTEND_URL = settings.FRONTEND_URL
    BACKEND_PORT = settings.BACKEND_PORT
    
    OPENAI_API_KEY = settings.OPENAI_API_KEY
    OPENAI_MODEL = settings.OPENAI_MODEL

config = Config()
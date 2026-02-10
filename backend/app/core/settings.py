import os
from flask import request
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv()  # optional; Pydantic can also load from .env via Config

class Settings(BaseSettings):
    PRODUCTION: bool = Field(
        default=(os.getenv("FLASK_ENV", "development") == "production" and True or False),
        description="Application mode: development or production"
    )
    
    FRONTEND_URL: str = Field(
        default=os.getenv("FRONTEND_URL", ""),
        description="Frontend application URL"
    )

    SERVER_API_URL: str = Field(
        default=os.getenv("SERVER_API_URL", "http://localhost:5000"),
        description="Backend API URL"
    )

    # Database
    SQLALCHEMY_DATABASE_URI: str = Field(
        default=os.getenv("SQLALCHEMY_DATABASE_URI"),
        description="Database connection URI"
    )
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = Field(default=None)
    GOOGLE_CLIENT_SECRET: str | None = Field(default=None)
    
    print(f"SERVER: {SERVER_API_URL.default}{PRODUCTION.default and '/api/v1' or ''}/auth/google/callback")
    
    GOOGLE_REDIRECT_URI: str = Field(
        default=f"{SERVER_API_URL.default}{PRODUCTION.default and '/api/v1' or ''}/auth/google/callback",
        description="Google OAuth redirect URI"
    )
    # Google Drive scopes
    GOOGLE_SCOPES: list[str] = [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file',
    ]
  
    OPENAI_API_KEY: str | None = Field(
        default=os.getenv("OPENAI_API_KEY"),
        description="OpenAI API Key"
    )
    OPENAI_MODEL: str = Field(
        default=os.getenv("OPENAI_MODEL", "gpt-5.1"),
        description="OpenAI API Model"
    )
    

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# single shared instance
settings = Settings()



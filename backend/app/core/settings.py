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

    BACKEND_PORT: int = Field(
        default=int(os.getenv("BACKEND_PORT", 5000)),
        description="Port for the backend server"
    )
    
    SERVER_API_URL: str = Field(
        default=os.getenv("SERVER_API_URL", f"http://localhost:{BACKEND_PORT}"),
        description="Backend API URL"
    )

    # Database
    SQLALCHEMY_DATABASE_URI: str = Field(
        default=os.getenv("SQLALCHEMY_DATABASE_URI"),
        description="Database connection URI"
    )
  
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



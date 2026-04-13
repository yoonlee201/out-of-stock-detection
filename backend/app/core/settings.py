import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from dotenv import load_dotenv

load_dotenv()  # optional; Pydantic can also load from .env via Config

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PRODUCTION: bool = Field(
        default=(os.getenv("FLASK_ENV", "development") == "production" and True or False),
        description="Application mode: development or production"
    )
    
    FRONTEND_URL: str = Field(
        default=os.getenv("FRONTEND_URL", "http://localhost:5173"),
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
        default=os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY"),
        description="OpenAI API Key"
    )
    OPENAI_API_BASE: str | None = Field(
        default=os.getenv("OPENAI_API_BASE") or os.getenv("openai_api_base"),
        description="OpenAI-compatible API base URL"
    )
    OPENAI_MODEL: str = Field(
        default=os.getenv("OPENAI_MODEL") or os.getenv("API_MODEL") or os.getenv("api_model") or "gpt-5.1",
        description="OpenAI API Model"
    )
    
    # Alerting
    GMAIL_ADDRESS: str = Field(
        default=os.getenv("GMAIL_ADDRESS", ""),
        description="Gmail address for sending alerts"
    )
    
    GMAIL_PASSWORD: str = Field(
        default=os.getenv("GMAIL_PASSWORD", ""),
        description="Gmail app password for sending alerts"
    )
    
    IPQS_API_KEY: str = Field(
        default=os.getenv("IPQS_API_KEY", ""),
        description="API key for NumVerify phone number validation"
    )

    SECRET_KEY: str = Field(
        default=os.getenv("SECRET_KEY", "dev-secret-key"),
        description="Secret key for signing tokens"
    )

    INVITATION_SECRET_KEY: str = Field(
        default=os.getenv("INVITATION_SECRET_KEY", "dev-secret-key"),
        description="Secret key for signing invitation tokens (falls back to SECRET_KEY)"
    )
# single shared instance
settings = Settings()


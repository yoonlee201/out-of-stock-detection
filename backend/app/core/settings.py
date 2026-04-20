import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator

# Resolve FLASK_ENV once at import time so SettingsConfigDict can branch on it.
_FLASK_ENV = os.getenv("FLASK_ENV", "development")
_IS_PRODUCTION = _FLASK_ENV == "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Zero-Trust boundary: production instances MUST inject secrets as OS
        # environment variables (e.g. via ECS task definitions, AWS Secrets
        # Manager, or EC2 instance metadata). Reading from a file on disk is
        # disabled in production to prevent accidental secret exposure.
        env_file=None if _IS_PRODUCTION else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Runtime mode ─────────────────────────────────────────────────────────
    FLASK_ENV: str = Field(default=_FLASK_ENV)
    PRODUCTION: bool = Field(default=_IS_PRODUCTION)

    # ── Network ───────────────────────────────────────────────────────────────
    FRONTEND_URL: str = Field(default="http://localhost:5173")
    BACKEND_PORT: int = Field(default=8000)
    SERVER_API_URL: str = Field(default="")

    # ── Database ──────────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI: str = Field(default="")

    # ── Optional LLM integration ──────────────────────────────────────────────
    OPENAI_API_KEY: str | None = Field(default=None)
    OPENAI_API_BASE: str | None = Field(default=None)
    OPENAI_MODEL: str = Field(default="gpt-4o")

    # ── Alerting ──────────────────────────────────────────────────────────────
    GMAIL_ADDRESS: str = Field(default="")
    GMAIL_PASSWORD: str = Field(default="")
    IPQS_API_KEY: str = Field(default="")

    # ── Auth tokens ───────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production")
    INVITATION_SECRET_KEY: str = Field(default="")

    @model_validator(mode="after")
    def _enforce_production_secrets(self) -> "Settings":
        """Fail fast at startup if required production secrets are missing or weak."""
        if not self.PRODUCTION:
            return self

        errors: list[str] = []

        if not self.SQLALCHEMY_DATABASE_URI:
            errors.append("SQLALCHEMY_DATABASE_URI must be set")

        if "dev-secret-key" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            errors.append(
                "SECRET_KEY must be a strong random value (≥ 32 chars). "
                "Generate one: python -c \"import secrets; print(secrets.token_hex(64))\""
            )

        if not self.FRONTEND_URL or self.FRONTEND_URL.startswith("http://localhost"):
            errors.append(
                "FRONTEND_URL must be the deployed frontend origin (not localhost)"
            )

        if errors:
            print("\nFATAL: Production configuration is invalid:", file=sys.stderr)
            for msg in errors:
                print(f"  ✗ {msg}", file=sys.stderr)
            print("", file=sys.stderr)
            sys.exit(1)

        return self

    def check_production(self) -> bool:
        return self.PRODUCTION


settings = Settings()

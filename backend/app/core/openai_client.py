from openai import OpenAI
from app.core.config import config

_client: OpenAI | None = None

if config.OPENAI_API_KEY:
    client_kwargs = {"api_key": config.OPENAI_API_KEY}
    if getattr(config, "OPENAI_API_BASE", None):
        client_kwargs["base_url"] = config.OPENAI_API_BASE
    _client = OpenAI(**client_kwargs)
_model = config.OPENAI_MODEL


def get_openai_client() -> OpenAI:
    if not _client:
        raise ValueError("OpenAI client is not initialized")
    return _client

def get_openai_model() -> str:
    return _model

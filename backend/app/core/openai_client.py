from openai import OpenAI
from app.core.config import config

if config.OPENAI_API_KEY:
    _client = OpenAI(api_key=config.OPENAI_API_KEY)
_model = config.OPENAI_MODEL


def get_openai_client() -> OpenAI:
    if not _client:
        raise ValueError("OpenAI client is not initialized")
    return _client

def get_openai_model() -> str:
    return _model

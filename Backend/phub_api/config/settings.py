from pathlib import Path
import os

from dotenv import load_dotenv

from phub_api.config.runtime import frontend_origins

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

COOKIE_NAME = "phub_session"


def jwt_secret() -> str:
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 32 or value.startswith("replace-"):
        raise RuntimeError("Configure JWT_SECRET with at least 32 random characters in Backend/.env")
    return value


TOKEN_TTL_SECONDS = 8 * 3600

"""Server-only configuration. Never expose the Supabase secret to a UI."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

COOKIE_NAME = "phub_session"


def frontend_origins() -> list[str]:
    return [origin.strip() for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8000,http://127.0.0.1:8000"
    ).split(",") if origin.strip()]


def jwt_secret() -> str:
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 32 or value.startswith("replace-"):
        raise RuntimeError("Configure JWT_SECRET with at least 32 random characters in Backend/.env")
    return value

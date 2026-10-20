"""HTTP cookie handling shared by login/logout and account password changes."""
import os

from fastapi import Response

from phub_api.config.settings import COOKIE_NAME, TOKEN_TTL_SECONDS


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE_NAME, token, httponly=True,
                        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
                        samesite="lax", max_age=TOKEN_TTL_SECONDS, path="/")
    response.headers["Cache-Control"] = "no-store"


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", samesite="lax")
    response.headers["Cache-Control"] = "no-store"

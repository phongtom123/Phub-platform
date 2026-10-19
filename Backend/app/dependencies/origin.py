from fastapi import HTTPException, Request

from app.config.settings import frontend_origins


def check_origin(request: Request) -> None:
    if request.headers.get("origin") not in frontend_origins():
        raise HTTPException(403, "Origin không được phép.")

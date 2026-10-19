import os
from dataclasses import asdict

from fastapi import Depends, Request, Response

from app.config.database import get_supabase
from app.config.settings import COOKIE_NAME
from app.dependencies.auth import current_user
from app.dependencies.origin import check_origin
from app.models.user import User
from app.schemas.auth import LoginBody, RegisterBody, TokenResponse
from app.services.auth import (
    authenticate_credentials, create_access_token, issue_session, register_customer,
    registration_attempts, throttle,
)


def login(body: LoginBody, request: Request, response: Response, db=Depends(get_supabase)):
    check_origin(request)
    user, password_hash = authenticate_credentials(body, request, db)
    issue_session(response, user, password_hash)
    return asdict(user)


def issue_token(body: LoginBody, request: Request, response: Response, db=Depends(get_supabase)):
    if "origin" in request.headers:
        check_origin(request)
    user, password_hash = authenticate_credentials(body, request, db)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return TokenResponse(access_token=create_access_token(user, password_hash))


def register(body: RegisterBody, request: Request, response: Response, db=Depends(get_supabase)):
    check_origin(request)
    throttle(request, registration_attempts, 5)
    user, password_hash = register_customer(body, db)
    issue_session(response, user, password_hash)
    return asdict(user)


def me(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return asdict(user)


def logout(request: Request, response: Response):
    check_origin(request)
    response.delete_cookie(COOKIE_NAME, path="/", secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", samesite="lax")
    response.headers["Cache-Control"] = "no-store"

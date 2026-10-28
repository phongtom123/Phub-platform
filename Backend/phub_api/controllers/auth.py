from dataclasses import asdict

from fastapi import APIRouter, Depends, Request, Response

from phub_api.dependencies.auth import current_user, get_auth_service
from phub_api.dependencies.origin import check_origin
from phub_api.middleware.session import clear_session_cookie, set_session_cookie
from phub_api.models.user import User
from phub_api.schemas.api_contracts import READ_ERRORS, SessionUser, WRITE_ERRORS, error_response
from phub_api.schemas.auth import LoginBody, RegisterBody, TokenResponse
from phub_api.services.auth import AuthService, create_access_token, registration_attempts, throttle


router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def issue_session(response: Response, user: User, password: str) -> None:
    set_session_cookie(response, create_access_token(user, password))


@router.post("/login", summary="Đăng nhập bằng tên tài khoản hoặc email", response_model=SessionUser,
             responses={**WRITE_ERRORS, 429: error_response(429, "Quá 20 lần đăng nhập/IP/phút; thử lại sau một phút.")})
def login(body: LoginBody, request: Request, response: Response, service: AuthService = Depends(get_auth_service)):
    check_origin(request)
    user, password = service.authenticate(body, request.client.host if request.client else "unknown")
    issue_session(response, user, password)
    return asdict(user)


@router.post("/token", summary="Lấy JWT Bearer để thử API trong Swagger/Postman", response_model=TokenResponse,
             responses={**WRITE_ERRORS, 429: error_response(429, "Dùng chung giới hạn 20 lần đăng nhập/IP/phút với /api/auth/login.")})
def issue_token(body: LoginBody, request: Request, response: Response, service: AuthService = Depends(get_auth_service)):
    if "origin" in request.headers:
        check_origin(request)
    user, password = service.authenticate(body, request.client.host if request.client else "unknown")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return TokenResponse(access_token=create_access_token(user, password))


@router.post("/register", status_code=201, summary="Đăng ký tài khoản khách hàng", response_model=SessionUser,
             responses={**WRITE_ERRORS, 429: error_response(429, "Quá 5 lần đăng ký/IP/phút; thử lại sau một phút.")})
def register(body: RegisterBody, request: Request, response: Response, service: AuthService = Depends(get_auth_service)):
    check_origin(request)
    throttle(request.client.host if request.client else "unknown", registration_attempts, 5)
    user, password = service.register(body)
    issue_session(response, user, password)
    return asdict(user)


@router.get("/me", summary="Lấy tài khoản, role và kho được phân công", response_model=SessionUser, responses=READ_ERRORS)
def me(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return asdict(user)


@router.post("/logout", status_code=204, summary="Đăng xuất và xóa cookie ở trình duyệt",
             responses={403: error_response(403, "Origin không được phép.")})
def logout(request: Request, response: Response):
    check_origin(request)
    clear_session_cookie(response)

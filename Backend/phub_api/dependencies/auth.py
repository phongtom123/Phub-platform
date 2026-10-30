from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer

from phub_api.config.database import get_supabase
from phub_api.config.settings import COOKIE_NAME
from phub_api.config.warehouse import OPERATING_WAREHOUSE_ID, WAREHOUSE_SCOPE_MESSAGE
from phub_api.models.user import User
from phub_api.repositories.auth import AuthRepository
from phub_api.services.auth import AuthService, verify_access_token
from phub_api.services.portal_handoff import PortalHandoffService

bearer_auth = HTTPBearer(
    scheme_name="BearerAuth", bearerFormat="JWT", auto_error=False,
    description="Lấy access_token từ POST /api/auth/token. Chỉ dán token, không thêm tiền tố Bearer; không dùng Supabase key.",
)
cookie_auth = APIKeyCookie(name=COOKIE_NAME, scheme_name="SessionCookie", auto_error=False)


def session_claims(
    request: Request,
    bearer: HTTPAuthorizationCredentials | None = Depends(bearer_auth),
    cookie: str | None = Depends(cookie_auth),
) -> dict:
    if "authorization" in request.headers:
        if bearer is None:
            raise HTTPException(401, "Authorization phải có dạng Bearer <token>.", headers={"WWW-Authenticate": "Bearer"})
        token = bearer.credentials
    else:
        token = cookie
    if not token:
        raise HTTPException(401, "Vui lòng đăng nhập.", headers={"WWW-Authenticate": "Bearer"})
    return verify_access_token(token)


def get_auth_service(db=Depends(get_supabase)) -> AuthService:
    return AuthService(AuthRepository(db))


def get_handoff_service(db=Depends(get_supabase)) -> PortalHandoffService:
    return PortalHandoffService(AuthRepository(db))


def current_user(claims: dict = Depends(session_claims), service: AuthService = Depends(get_auth_service)) -> User:
    return service.current_user(claims)


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(403, "Chỉ quản trị viên được truy cập chức năng này.")
    return user


def require_warehouse(user: User = Depends(current_user)) -> User:
    if user.role != "NHAN_VIEN" or user.warehouse_id is None:
        raise HTTPException(403, "Chỉ thủ kho đã được phân kho mới được truy cập chức năng này.")
    if user.warehouse_id != OPERATING_WAREHOUSE_ID:
        raise HTTPException(403, WAREHOUSE_SCOPE_MESSAGE + ' Liên hệ ADMIN để đổi phân công kho.')
    return user


def require_customer_user(user: User = Depends(current_user)) -> User:
    if user.role != "KHACH_HANG" or not user.customer_id:
        raise HTTPException(403, "Chỉ khách hàng được truy cập chức năng này.")
    return user

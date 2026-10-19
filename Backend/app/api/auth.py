from fastapi import APIRouter

from app.controllers import auth
from app.schemas.auth import TokenResponse
from app.schemas.api_contracts import SessionUser
from app.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

router.post("/login", summary="Đăng nhập bằng tên tài khoản hoặc email", response_model=SessionUser,
             responses={**WRITE_ERRORS, 429: error_response(429, "Quá 20 lần đăng nhập/IP/phút; thử lại sau một phút.")})(auth.login)

router.post("/token", summary="Lấy JWT Bearer để thử API trong Swagger/Postman", response_model=TokenResponse,
             responses={**WRITE_ERRORS, 429: error_response(429, "Dùng chung giới hạn 20 lần đăng nhập/IP/phút với /api/auth/login.")})(auth.issue_token)

router.post("/register", status_code=201, summary="Đăng ký tài khoản khách hàng", response_model=SessionUser,
             responses={**WRITE_ERRORS, 429: error_response(429, "Quá 5 lần đăng ký/IP/phút; thử lại sau một phút.")})(auth.register)

router.get("/me", summary="Lấy tài khoản, role và kho được phân công", response_model=SessionUser, responses=READ_ERRORS)(auth.me)

router.post("/logout", status_code=204, summary="Đăng xuất và xóa cookie ở trình duyệt",
             responses={403: error_response(403, "Origin không được phép.")})(auth.logout)

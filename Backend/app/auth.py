"""DB-backed login and server-side authorization; no role from URL/localStorage."""
import hashlib
import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher
from pwdlib.exceptions import UnknownHashError

from .config import COOKIE_NAME, frontend_origins, jwt_secret
from .supabase import get_supabase
from .api_contracts import READ_ERRORS, WRITE_ERRORS, SessionUser, error_response

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
passwords = PasswordHash((Argon2Hasher(), BcryptHasher()))
dummy_hash = passwords.hash("not-a-valid-login-password")
login_attempts: dict[str, tuple[float, int]] = {}
attempt_lock = Lock()


@dataclass
class User:
    account_id: str
    username: str
    role: str
    name: str
    customer_id: str | None = None
    employee_id: str | None = None
    warehouse_id: int | None = None


def check_origin(request: Request) -> None:
    # Cookie authentication requires an explicit trusted browser origin on writes.
    if request.headers.get("origin") not in frontend_origins():
        raise HTTPException(403, "Origin không được phép.")


def identity(account: dict, db) -> User:
    if account.get("trang_thai") != 1:
        raise HTTPException(401, "Tài khoản không hoạt động.")
    employee, customer = account.get("ma_nhan_vien"), account.get("ma_kh")
    if bool(employee) == bool(customer):
        raise HTTPException(403, "Tài khoản chưa được gán đúng người dùng.")
    if employee:
        rows = db.table("NHAN_VIEN").select("ma_nhan_vien,ho_ten,loai_nhan_vien,ma_kho,trang_thai").eq("ma_nhan_vien", employee).limit(1).execute().data
        if not rows or rows[0]["trang_thai"] != 1:
            raise HTTPException(403, "Nhân viên không hoạt động.")
        profile = rows[0]
        role = profile["loai_nhan_vien"]
        if role not in {"ADMIN", "THU_KHO"} or (role == "THU_KHO" and profile["ma_kho"] is None):
            raise HTTPException(403, "Chưa được phân quyền hoặc phân kho.")
        return User(account["ma_tk"], account["ten_tai_khoan"], role, profile["ho_ten"], employee_id=employee, warehouse_id=profile["ma_kho"])
    rows = db.table("KHACH_HANG").select("ma_kh,ten_kh").eq("ma_kh", customer).limit(1).execute().data
    if not rows:
        raise HTTPException(403, "Không tìm thấy khách hàng.")
    return User(account["ma_tk"], account["ten_tai_khoan"], "KHACH_HANG", rows[0]["ten_kh"], customer_id=customer)


def password_version(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def current_user(request: Request, db=Depends(get_supabase)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Vui lòng đăng nhập.")
    try:
        claims = jwt.decode(token, jwt_secret(), algorithms=["HS256"], issuer="phub-backend", audience="phub-ui",
                            options={"require": ["sub", "exp", "iat", "iss", "aud", "ver"]})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Phiên đăng nhập đã hết hạn.") from None
    rows = db.table("TAI_KHOAN").select("ma_tk,ten_tai_khoan,ma_kh,ma_nhan_vien,trang_thai,mat_khau_hash").eq("ma_tk", claims["sub"]).limit(1).execute().data
    if not rows or password_version(rows[0]["mat_khau_hash"]) != claims["ver"]:
        raise HTTPException(401, "Phiên đăng nhập không còn hợp lệ.")
    return identity(rows[0], db)


class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=254, description="Tên tài khoản hoặc email đã tạo trong database.", examples=["example.admin"])
    password: str = Field(min_length=1, max_length=128, description="Mật khẩu của tài khoản thật; không phải khóa Supabase.",
                          json_schema_extra={"writeOnly": True, "format": "password"})


def throttle(request: Request) -> None:
    # Local-development protection. Use a shared Redis limiter before multi-worker deployment.
    host = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with attempt_lock:
        expired = [key for key, (start, _) in login_attempts.items() if now - start >= 60]
        for key in expired:
            del login_attempts[key]
        start, count = login_attempts.get(host, (now, 0))
        if count >= 20:
            raise HTTPException(429, "Thử lại sau một phút.")
        login_attempts[host] = (start, count + 1)


@router.post("/login", summary="Đăng nhập bằng tên tài khoản hoặc email", response_model=SessionUser,
             responses={**WRITE_ERRORS, 429: error_response(429, "Quá 20 lần đăng nhập/IP/phút; thử lại sau một phút.")})
def login(body: LoginBody, request: Request, response: Response, db=Depends(get_supabase)):
    check_origin(request)
    throttle(request)
    secret = jwt_secret()
    username = body.username.strip()
    column = "email" if "@" in username else "ten_tai_khoan"
    rows = db.table("TAI_KHOAN").select("ma_tk,ten_tai_khoan,ma_kh,ma_nhan_vien,trang_thai,mat_khau_hash").eq(column, username).limit(1).execute().data
    account = rows[0] if rows else None
    try:
        valid = passwords.verify(body.password, account["mat_khau_hash"] if account else dummy_hash)
    except (ValueError, TypeError, UnknownHashError):
        valid = False
    if not account or not valid:
        raise HTTPException(401, "Tài khoản hoặc mật khẩu không đúng.")
    user = identity(account, db)
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": user.account_id, "iat": now, "exp": now + timedelta(hours=8),
                        "iss": "phub-backend", "aud": "phub-ui", "ver": password_version(account["mat_khau_hash"])}, secret, algorithm="HS256")
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
                        samesite="lax", max_age=8 * 3600, path="/")
    response.headers["Cache-Control"] = "no-store"
    return asdict(user)


@router.get("/me", summary="Lấy tài khoản, role và kho được phân công", response_model=SessionUser, responses=READ_ERRORS)
def me(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return asdict(user)


@router.post("/logout", status_code=204, summary="Đăng xuất và xóa cookie ở trình duyệt",
             responses={403: error_response(403, "Origin không được phép.")})
def logout(request: Request, response: Response):
    check_origin(request)
    response.delete_cookie(COOKIE_NAME, path="/", secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", samesite="lax")
    response.headers["Cache-Control"] = "no-store"

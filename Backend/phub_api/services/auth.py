import hashlib
import os
import time
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import uuid4
from postgrest.exceptions import APIError

import jwt
from fastapi import HTTPException, Request, Response
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher
from pwdlib.exceptions import UnknownHashError

from phub_api.config.settings import COOKIE_NAME, TOKEN_TTL_SECONDS, jwt_secret
from phub_api.models.user import User
from phub_api.schemas.auth import LoginBody, RegisterBody

passwords = PasswordHash((Argon2Hasher(), BcryptHasher()))
dummy_hash = passwords.hash("not-a-valid-login-password")
login_attempts: dict[str, tuple[float, int]] = {}
registration_attempts: dict[str, tuple[float, int]] = {}
attempt_lock = Lock()


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


def verify_access_token(token: str) -> dict:
    try:
        if jwt.get_unverified_header(token).get("alg") != "HS256":
            raise jwt.InvalidTokenError("Unsupported token algorithm")
        claims = jwt.decode(token, jwt_secret(), algorithms=["HS256"], issuer="phub-backend", audience="phub-ui",
                            options={"require": ["sub", "exp", "iat", "iss", "aud", "ver"]})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", headers={"WWW-Authenticate": "Bearer"}) from None
    account_id = claims.get("sub")
    if not isinstance(account_id, str) or not account_id or len(account_id) > 100:
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ.", headers={"WWW-Authenticate": "Bearer"})
    return claims


def throttle(request: Request, attempts: dict[str, tuple[float, int]] = login_attempts, limit: int = 20) -> None:
    host = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with attempt_lock:
        expired = [key for key, (start, _) in attempts.items() if now - start >= 60]
        for key in expired:
            del attempts[key]
        start, count = attempts.get(host, (now, 0))
        if count >= limit:
            raise HTTPException(429, "Thử lại sau một phút.")
        attempts[host] = (start, count + 1)


def create_access_token(user: User, password_hash: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user.account_id, "iat": now, "exp": now + timedelta(seconds=TOKEN_TTL_SECONDS),
                        "iss": "phub-backend", "aud": "phub-ui", "ver": password_version(password_hash)},
                       jwt_secret(), algorithm="HS256")


def issue_session(response: Response, user: User, password_hash: str) -> None:
    token = create_access_token(user, password_hash)
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
                        samesite="lax", max_age=TOKEN_TTL_SECONDS, path="/")
    response.headers["Cache-Control"] = "no-store"


def authenticate_credentials(body: LoginBody, request: Request, db) -> tuple[User, str]:
    throttle(request)
    jwt_secret()
    username = body.username.strip()
    column = "email" if "@" in username else "ten_tai_khoan"
    if column == "email":
        username = username.lower()
    rows = db.table("TAI_KHOAN").select("ma_tk,ten_tai_khoan,ma_kh,ma_nhan_vien,trang_thai,mat_khau_hash").eq(column, username).limit(1).execute().data
    account = rows[0] if rows else None
    try:
        valid = passwords.verify(body.password, account["mat_khau_hash"] if account else dummy_hash)
    except (ValueError, TypeError, UnknownHashError):
        valid = False
    if not account or not valid:
        raise HTTPException(401, "Tài khoản hoặc mật khẩu không đúng.")
    user = identity(account, db)
    return user, account["mat_khau_hash"]


def register_customer(body: RegisterBody, db) -> tuple[User, str]:
    jwt_secret()
    password_hash = passwords.hash(body.password)
    customer_id = "KH_" + uuid4().hex
    try:
        result = db.rpc("customer_register_v1", {
            "p_username": body.username,
            "p_email": body.email,
            "p_password_hash": password_hash,
            "p_customer_id": customer_id,
            "p_name": body.name,
            "p_phone": body.phone,
        }).execute().data
    except APIError as exc:
        code = str(exc.code)
        if code == "PGRST202":
            raise HTTPException(503, "Chưa cài chức năng đăng ký khách hàng trong database. Cần chạy migration customer_self_registration.") from None
        if code == "23505":
            raise HTTPException(409, "Tên tài khoản hoặc email đã được sử dụng.") from None
        if code in {"23502", "23514", "22P02"}:
            raise HTTPException(422, "Thông tin đăng ký không hợp lệ.") from None
        raise
    if not isinstance(result, dict) or not result.get("account_id"):
        raise RuntimeError("Customer registration returned an invalid response")
    user = User(
        account_id=result["account_id"], username=result["username"], role="KHACH_HANG",
        name=result["name"], customer_id=result["customer_id"],
    )
    return user, password_hash

from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import uuid4
import hashlib
import hmac
import time

from fastapi import HTTPException
from postgrest.exceptions import APIError
import jwt

from phub_api.config.settings import TOKEN_TTL_SECONDS, jwt_secret
from phub_api.models.user import User
from phub_api.repositories.auth import AuthRepository
from phub_api.schemas.auth import LoginBody, RegisterBody

login_attempts: dict[str, tuple[float, int]] = {}
registration_attempts: dict[str, tuple[float, int]] = {}
attempt_lock = Lock()


def identity(account: dict, repository: AuthRepository) -> User:
    if account.get("trang_thai") != 1:
        raise HTTPException(401, "Tài khoản không hoạt động.")
    employee, customer = account.get("ma_nhan_vien"), account.get("ma_kh")
    if bool(employee) == bool(customer):
        raise HTTPException(403, "Tài khoản chưa được gán đúng người dùng.")
    if employee:
        rows = repository.employee(employee)
        if not rows or rows[0]["trang_thai"] != 1:
            raise HTTPException(403, "Nhân viên không hoạt động.")
        profile = rows[0]
        role = profile["loai_nhan_vien"]
        if role not in {"ADMIN", "NHAN_VIEN"} or (role == "NHAN_VIEN" and profile["ma_kho"] is None):
            raise HTTPException(403, "Chưa được phân quyền hoặc phân kho.")
        return User(account["ma_tk"], account["ten_tai_khoan"], role, profile["ho_ten"], employee_id=employee, warehouse_id=profile["ma_kho"])
    rows = repository.customer(customer)
    if not rows:
        raise HTTPException(403, "Không tìm thấy khách hàng.")
    return User(account["ma_tk"], account["ten_tai_khoan"], "KHACH_HANG", rows[0]["ten_kh"], customer_id=customer)


def password_matches(candidate: str, stored: str | None) -> bool:
    """Plaintext storage requested by the project; never trim or return credentials."""
    return isinstance(candidate, str) and isinstance(stored, str) and bool(stored) and hmac.compare_digest(candidate.encode(), stored.encode())


def password_version(value: str) -> str:
    return hmac.new(jwt_secret().encode(), b"phub-password-version-v2\0" + value.encode(), hashlib.sha256).hexdigest()


def credential_state(account: dict) -> str:
    # Revision changes even when a password is reset to its previous value.
    return account["mat_khau"] + "\0" + str(account["phien_ban_mat_khau"])


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


def throttle(host: str, attempts: dict[str, tuple[float, int]] = login_attempts, limit: int = 20) -> None:
    now = time.monotonic()
    with attempt_lock:
        expired = [key for key, (start, _) in attempts.items() if now - start >= 60]
        for key in expired:
            del attempts[key]
        start, count = attempts.get(host, (now, 0))
        if count >= limit:
            raise HTTPException(429, "Thử lại sau một phút.")
        attempts[host] = (start, count + 1)


def create_access_token(user: User, password: str) -> str:
    return create_access_token_from_version(user, password_version(password))


def create_access_token_from_version(user: User, version: str) -> str:
    """Used only after a password login or a consumed, revalidated portal handoff."""
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user.account_id, "iat": now, "exp": now + timedelta(seconds=TOKEN_TTL_SECONDS),
                        "iss": "phub-backend", "aud": "phub-ui", "ver": version},
                       jwt_secret(), algorithm="HS256")


def authenticate_credentials(body: LoginBody, host: str, repository: AuthRepository) -> tuple[User, str]:
    throttle(host)
    jwt_secret()
    username = body.username.strip()
    column = "email" if "@" in username else "ten_tai_khoan"
    if column == "email":
        username = username.lower()
    rows = repository.login_account(column, username)
    account = rows[0] if rows else None
    valid = password_matches(body.password, account.get("mat_khau") if account else None)
    if not account or not valid:
        raise HTTPException(401, "Tài khoản hoặc mật khẩu không đúng.")
    user = identity(account, repository)
    return user, credential_state(account)


def register_customer(body: RegisterBody, repository: AuthRepository) -> tuple[User, str]:
    jwt_secret()
    password = body.password
    customer_id = "KH_" + uuid4().hex
    try:
        result = repository.register_customer({
            "p_username": body.username,
            "p_email": body.email,
            "p_password": password,
            "p_customer_id": customer_id,
            "p_name": body.name,
            "p_phone": body.phone,
        })
    except APIError as exc:
        code = str(exc.code)
        if code == "PGRST202":
            raise HTTPException(503, "Chưa cài chức năng đăng ký khách hàng trong database. Cần chạy migration 20261024161801_account_plaintext_passwords.sql.") from None
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
    return user, password + "\0" + str(result["credential_version"])


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    def authenticate(self, body: LoginBody, host: str):
        return authenticate_credentials(body, host, self.repository)

    def register(self, body: RegisterBody):
        return register_customer(body, self.repository)

    def current_user(self, claims: dict) -> User:
        rows = self.repository.account(claims["sub"])
        if not rows or password_version(credential_state(rows[0])) != claims["ver"]:
            raise HTTPException(401, "Phiên đăng nhập không còn hợp lệ.", headers={"WWW-Authenticate": "Bearer"})
        return identity(rows[0], self.repository)

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from ..auth import User, check_origin, current_user, logout, throttle
from ..api_contracts import READ_ERRORS, WRITE_ERRORS, error_response
from ..supabase import get_supabase
from .schemas import AccountCreate, AccountPage, AccountRead, AccountUpdate, Identifier, OwnerPage, PasswordChange, PasswordReset, Role, RoleUpdate, Status, StatusUpdate
from .service import Accounts

router = APIRouter(prefix="/api/admin", tags=["Admin · Tài khoản"])
ERRORS = {**WRITE_ERRORS, 404: error_response(404, "Tài khoản không tồn tại.")}


def admin(user: User = Depends(current_user)) -> User:
    from fastapi import HTTPException
    if user.role != "ADMIN":
        raise HTTPException(403, "Chỉ quản trị viên được quản lý tài khoản.")
    return user


def read_service(response: Response, user: User = Depends(admin), db=Depends(get_supabase)):
    response.headers["Cache-Control"] = "no-store"
    return Accounts(db, user)


def write_service(request: Request, service: Accounts = Depends(read_service)):
    check_origin(request)
    return service


Read = Annotated[Accounts, Depends(read_service)]
Write = Annotated[Accounts, Depends(write_service)]


@router.get("/accounts", response_model=AccountPage, responses=READ_ERRORS, summary="Danh sách tài khoản, lọc vai trò/trạng thái")
def list_accounts(service: Read, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  q: str = Query("", max_length=100), status: int | None = Query(None, ge=0, le=2), role: Role | None = None):
    return service.page(page, page_size, q, status, role)


@router.get("/account-owners", response_model=OwnerPage, responses=READ_ERRORS, summary="Tra cứu hồ sơ để cấp tài khoản")
def account_owners(service: Read, kind: Literal["employees", "customers"] = "employees", q: str = Query("", max_length=100),
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return service.owners(kind, page, page_size, q)


@router.post("/accounts", status_code=201, response_model=AccountRead, responses=ERRORS, summary="Cấp tài khoản cho một nhân viên hoặc khách có sẵn")
def create_account(body: AccountCreate, service: Write):
    """Vai trò lấy từ hồ sơ liên kết. Không nhận role/hash/trạng thái từ trình duyệt.
    Username 3–80 ký tự ASCII chữ/số/._- (không có @); email chuẩn hóa chữ thường.
    Mật khẩu 10–128 ký tự, hash Argon2. Không tạo hồ sơ nhân viên/khách cùng request.
    """
    return service.create(body)


@router.get("/accounts/{account_id}", response_model=AccountRead, responses=ERRORS, summary="Chi tiết tài khoản, không trả mật khẩu")
def get_account(account_id: Identifier, service: Read):
    return service.detail(account_id)


@router.patch("/accounts/{account_id}", response_model=AccountRead, responses=ERRORS, summary="Sửa tên đăng nhập và email")
def update_account(account_id: Identifier, body: AccountUpdate, service: Write):
    """Khóa chính và chủ sở hữu bất biến; trạng thái/vai trò/mật khẩu có API riêng."""
    return service.update(account_id, body)


@router.post("/accounts/{account_id}/status", response_model=AccountRead, responses=ERRORS, summary="Ẩn (0), mở khóa (1), tạm khóa (2) tài khoản")
def set_status(account_id: Identifier, body: StatusUpdate, service: Write):
    """Không xóa lịch sử; chặn tự ẩn/khóa. Phiên bị từ chối khi tài khoản không active.
    Chưa có blacklist phiên: mở lại tài khoản có thể khôi phục token chưa hết hạn.
    """
    return service.status(account_id, body.trang_thai)


@router.put("/accounts/{account_id}/role", response_model=AccountRead, responses=ERRORS, summary="Đổi quyền ADMIN/THU_KHO và kho của nhân viên")
def set_role(account_id: Identifier, body: RoleUpdate, service: Write):
    """Cập nhật role và ma_kho cùng một dòng NHAN_VIEN. Không nâng quyền khách hàng;
    ADMIN có ma_kho=null, THU_KHO có kho hoạt động. Chặn tự hạ quyền.
    """
    return service.role(account_id, body)


@router.post("/accounts/{account_id}/password", response_model=AccountRead, responses=ERRORS, summary="ADMIN cấp lại mật khẩu cho tài khoản khác")
def reset_password(account_id: Identifier, body: PasswordReset, service: Write):
    """Thay hash làm token cũ không còn hợp lệ. Mật khẩu không được trả trong response."""
    return service.password(account_id, body.password)


@router.get("/me", response_model=AccountRead, responses=ERRORS, summary="Thông tin tài khoản admin đang đăng nhập")
def my_account(service: Read):
    return service.detail(service.actor.account_id)


@router.patch("/me", response_model=AccountRead, responses=ERRORS, summary="Sửa tên đăng nhập/email của chính admin")
def update_me(body: AccountUpdate, service: Write):
    return service.update(service.actor.account_id, body)


@router.post("/me/password", response_model=AccountRead, responses={**ERRORS, 429: error_response(429, "Quá nhiều lần thử mật khẩu; thử lại sau một phút.")}, summary="Đổi mật khẩu admin bằng mật khẩu hiện tại")
def change_my_password(body: PasswordChange, request: Request, response: Response, service: Write):
    throttle(request)
    result = service.password(service.actor.account_id, body.password, body.current_password)
    logout(request, response)
    return result

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from phub_api.dependencies.admin_accounts import read_service, write_service
from phub_api.middleware.session import clear_session_cookie
from phub_api.schemas.admin_accounts import (
    AccountCreate,
    AccountPage,
    AccountRead,
    AccountUpdate,
    Identifier,
    NewAccountCreate,
    OwnerPage,
    PasswordChange,
    PasswordReset,
    Role,
    RoleUpdate,
    StatusUpdate,
)
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response
from phub_api.services.admin_accounts import AccountsService
from phub_api.services.auth import throttle


ERRORS = {**WRITE_ERRORS, 404: error_response(404, "Tài khoản không tồn tại.")}

router = APIRouter(prefix="/api/admin", tags=["Admin · Tài khoản"])

Read = Annotated[AccountsService, Depends(read_service)]
Write = Annotated[AccountsService, Depends(write_service)]


@router.get("/accounts", response_model=AccountPage, responses=READ_ERRORS, summary="Danh sách tài khoản, lọc vai trò/trạng thái")
def list_accounts(service: Read, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  q: str = Query("", max_length=100), status: int | None = Query(None, ge=0, le=2), role: Role | None = None):
    return service.page(page, page_size, q, status, role)


@router.get("/account-owners", response_model=OwnerPage, responses=READ_ERRORS, summary="Tra cứu hồ sơ để cấp tài khoản")
def account_owners(service: Read, kind: Literal["employees", "customers"] = "employees", q: str = Query("", max_length=100),
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return service.owners(kind, page, page_size, q)


@router.post("/accounts", status_code=201, response_model=AccountRead, responses=ERRORS, summary="Tạo người mới cùng tài khoản, hoặc cấp tài khoản cho người có sẵn")
def create_account(body: NewAccountCreate | AccountCreate, service: Write):
    return service.create_new(body) if isinstance(body, NewAccountCreate) else service.create(body)


@router.get("/accounts/{account_id}", response_model=AccountRead, responses=ERRORS, summary="Chi tiết tài khoản, không trả mật khẩu")
def get_account(account_id: Identifier, service: Read):
    return service.detail(account_id)


@router.patch("/accounts/{account_id}", response_model=AccountRead, responses=ERRORS, summary="Sửa tên đăng nhập và email")
def update_account(account_id: Identifier, body: AccountUpdate, service: Write):
    return service.update(account_id, body)


@router.post("/accounts/{account_id}/status", response_model=AccountRead, responses=ERRORS, summary="Ẩn (0), mở khóa (1), tạm khóa (2) tài khoản")
def set_status(account_id: Identifier, body: StatusUpdate, service: Write):
    return service.status(account_id, body.trang_thai)


@router.put("/accounts/{account_id}/role", response_model=AccountRead, responses=ERRORS, summary="Đổi quyền ADMIN/THU_KHO và kho của nhân viên")
def set_role(account_id: Identifier, body: RoleUpdate, service: Write):
    return service.role(account_id, body)


@router.post("/accounts/{account_id}/password", response_model=AccountRead, responses=ERRORS, summary="ADMIN cấp lại mật khẩu cho tài khoản khác")
def reset_password(account_id: Identifier, body: PasswordReset, service: Write):
    return service.password(account_id, body.password)


@router.get("/me", response_model=AccountRead, responses=ERRORS, summary="Thông tin tài khoản admin đang đăng nhập")
def my_account(service: Read):
    return service.detail(service.actor.account_id)


@router.patch("/me", response_model=AccountRead, responses=ERRORS, summary="Sửa tên đăng nhập/email của chính admin")
def update_me(body: AccountUpdate, service: Write):
    return service.update(service.actor.account_id, body)


@router.post("/me/password", response_model=AccountRead, responses={**ERRORS, 429: error_response(429, "Quá nhiều lần thử mật khẩu; thử lại sau một phút.")}, summary="Đổi mật khẩu admin bằng mật khẩu hiện tại")
def change_my_password(body: PasswordChange, request: Request, response: Response, service: Write):
    throttle(request.client.host if request.client else "unknown")
    result = service.password(service.actor.account_id, body.password, body.current_password)
    clear_session_cookie(response)
    return result

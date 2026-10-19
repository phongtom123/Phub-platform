from fastapi import APIRouter

from app.controllers import admin_accounts
from app.schemas.admin_accounts import AccountPage, AccountRead, OwnerPage
from app.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response

ERRORS = {**WRITE_ERRORS, 404: error_response(404, "Tài khoản không tồn tại.")}

router = APIRouter(prefix="/api/admin", tags=["Admin · Tài khoản"])

router.get("/accounts", response_model=AccountPage, responses=READ_ERRORS, summary="Danh sách tài khoản, lọc vai trò/trạng thái")(admin_accounts.list_accounts)

router.get("/account-owners", response_model=OwnerPage, responses=READ_ERRORS, summary="Tra cứu hồ sơ để cấp tài khoản")(admin_accounts.account_owners)

router.post("/accounts", status_code=201, response_model=AccountRead, responses=ERRORS, summary="Tạo người mới cùng tài khoản, hoặc cấp tài khoản cho người có sẵn")(admin_accounts.create_account)

router.get("/accounts/{account_id}", response_model=AccountRead, responses=ERRORS, summary="Chi tiết tài khoản, không trả mật khẩu")(admin_accounts.get_account)

router.patch("/accounts/{account_id}", response_model=AccountRead, responses=ERRORS, summary="Sửa tên đăng nhập và email")(admin_accounts.update_account)

router.post("/accounts/{account_id}/status", response_model=AccountRead, responses=ERRORS, summary="Ẩn (0), mở khóa (1), tạm khóa (2) tài khoản")(admin_accounts.set_status)

router.put("/accounts/{account_id}/role", response_model=AccountRead, responses=ERRORS, summary="Đổi quyền ADMIN/THU_KHO và kho của nhân viên")(admin_accounts.set_role)

router.post("/accounts/{account_id}/password", response_model=AccountRead, responses=ERRORS, summary="ADMIN cấp lại mật khẩu cho tài khoản khác")(admin_accounts.reset_password)

router.get("/me", response_model=AccountRead, responses=ERRORS, summary="Thông tin tài khoản admin đang đăng nhập")(admin_accounts.my_account)

router.patch("/me", response_model=AccountRead, responses=ERRORS, summary="Sửa tên đăng nhập/email của chính admin")(admin_accounts.update_me)

router.post("/me/password", response_model=AccountRead, responses={**ERRORS, 429: error_response(429, "Quá nhiều lần thử mật khẩu; thử lại sau một phút.")}, summary="Đổi mật khẩu admin bằng mật khẩu hiện tại")(admin_accounts.change_my_password)

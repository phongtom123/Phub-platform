from uuid import uuid4

from fastapi import HTTPException
from postgrest.exceptions import APIError

from phub_api.models.user import User
from phub_api.repositories.admin_accounts import ACCOUNT_COLUMNS, AccountsRepository
from phub_api.schemas.admin_accounts import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
    NewAccountCreate,
    RoleUpdate,
)
from phub_api.services.auth import password_matches


class AccountsService:
    def __init__(self, repository: AccountsRepository, actor: User):
        self.repository, self.actor = repository, actor

    def employee(self, employee_id: str) -> dict:
        rows = self.repository.employee(employee_id)
        if not rows:
            raise HTTPException(422, "Nhân viên không tồn tại.")
        return rows[0]

    def account(self, account_id: str) -> dict:
        rows = self.repository.account(account_id)
        if not rows:
            raise HTTPException(404, "Không tìm thấy tài khoản.")
        return rows[0]

    def public(self, row: dict, employee: dict | None = None, customer: dict | None = None) -> AccountRead:
        if row.get("ma_nhan_vien"):
            profile = employee or self.employee(row["ma_nhan_vien"])
            role, name, warehouse = profile["loai_nhan_vien"], profile["ho_ten"], profile.get("ma_kho")
            active = profile["trang_thai"] == 1
        else:
            if customer is None:
                rows = self.repository.customer(row["ma_kh"])
                if not rows:
                    raise HTTPException(422, "Hồ sơ khách hàng không tồn tại.")
                customer = rows[0]
            role, name, warehouse, active = "KHACH_HANG", customer["ten_kh"], None, True
        avatar = row.get("avatar")
        avatar_url = avatar.get("url") if isinstance(avatar, dict) else None
        return AccountRead(**{key: row.get(key) for key in ACCOUNT_COLUMNS.split(",")},
                           role=role, ho_ten=name, ma_kho=warehouse, owner_active=active,
                           is_self=row["ma_tk"] == self.actor.account_id, avatar_url=avatar_url)

    def detail(self, account_id: str) -> AccountRead:
        return self.public(self.account(account_id))

    def page(self, page: int, page_size: int, q: str, status: int | None, role: str | None):
        result = self.repository.page(page, page_size, q, status, role)
        return {"data": [self.public(row, row.get("employee"), row.get("customer")) for row in result.data],
                "total": result.count or 0, "page": page, "page_size": page_size}

    def owners(self, kind: str, page: int, page_size: int, q: str):
        employee = kind == "employees"
        key, name = ("ma_nhan_vien", "ho_ten") if employee else ("ma_kh", "ten_kh")
        result = self.repository.owners(kind, page, page_size, q)
        return {"data": [{"id": row[key], "name": row[name], "role": row["loai_nhan_vien"] if employee else "KHACH_HANG",
                          "ma_kho": row.get("ma_kho"), "has_account": bool(row.get("account"))} for row in result.data],
                "total": result.count or 0, "page": page, "page_size": page_size}

    def create(self, body: AccountCreate):
        owner = body.ma_nhan_vien or body.ma_kh
        field = "ma_nhan_vien" if body.ma_nhan_vien else "ma_kh"
        if body.ma_nhan_vien:
            profile = self.employee(owner)
            if profile["trang_thai"] != 1 or profile["loai_nhan_vien"] not in {"ADMIN", "THU_KHO"}:
                raise HTTPException(422, "Nhân viên không hoạt động hoặc chưa có vai trò hợp lệ.")
            if (profile["loai_nhan_vien"] == "ADMIN") != (profile.get("ma_kho") is None):
                raise HTTPException(422, "Phân công kho của nhân viên chưa hợp lệ.")
            if profile["loai_nhan_vien"] == "THU_KHO":
                warehouses = self.repository.warehouse(profile["ma_kho"])
                if not warehouses or warehouses[0]["trang_thai"] != 1:
                    raise HTTPException(422, "Kho được phân công không hoạt động.")
        elif not self.repository.customer(owner):
            raise HTTPException(422, "Khách hàng không tồn tại.")
        if self.repository.owner_has_account(field, owner):
            raise HTTPException(409, "Người này đã có tài khoản. Mỗi người chỉ được có một tài khoản.")
        values = body.model_dump(exclude={"password"}) | {"mat_khau": body.password, "trang_thai": 1}
        result = self.repository.insert(values)
        if not result:
            raise RuntimeError("Account insert returned no rows")
        return self.detail(body.ma_tk)

    def create_new(self, body: NewAccountCreate):
        owner = body.new_owner
        owner_id = ("KH_" if owner.role == "KHACH_HANG" else "NV_") + uuid4().hex
        try:
            result = self.repository.create_new({
                "p_actor_account_id": self.actor.account_id,
                "p_username": body.ten_tai_khoan,
                "p_email": body.email,
                "p_password": body.password,
                "p_owner_id": owner_id,
                "p_name": owner.ho_ten,
                "p_role": owner.role,
                "p_warehouse_id": owner.ma_kho,
            })
        except APIError as exc:
            if str(exc.code) == "PGRST202":
                raise HTTPException(503, "Chưa cài chức năng tạo tài khoản mới trong database. Cần chạy migration 20261024161801_account_plaintext_passwords.sql.") from None
            if str(exc.code) == "42501":
                raise HTTPException(403, "Phiên quản trị không còn hợp lệ hoặc API chưa được cấp quyền gọi chức năng tạo tài khoản.") from None
            raise
        return AccountRead.model_validate(result)

    def update(self, account_id: str, body: AccountUpdate):
        self.account(account_id)
        rows = self.repository.update(account_id, body.model_dump(exclude_unset=True))
        if not rows:
            raise HTTPException(404, "Không tìm thấy tài khoản.")
        return self.detail(account_id)

    def status(self, account_id: str, value: int):
        self.account(account_id)
        if account_id == self.actor.account_id and value != 1:
            raise HTTPException(409, "Không được khóa hoặc ẩn tài khoản đang đăng nhập.")
        self.repository.update(account_id, {"trang_thai": value})
        return self.detail(account_id)

    def role(self, account_id: str, body: RoleUpdate):
        account = self.account(account_id)
        if not account["ma_nhan_vien"]:
            raise HTTPException(422, "Không nâng quyền khách hàng. Chỉ đổi vai trò tài khoản nhân viên.")
        employee = self.employee(account["ma_nhan_vien"])
        if employee["trang_thai"] != 1:
            raise HTTPException(422, "Nhân viên không hoạt động.")
        if account_id == self.actor.account_id and body.role != "ADMIN":
            raise HTTPException(409, "Không được hạ quyền tài khoản đang đăng nhập.")
        if body.ma_kho is not None:
            rows = self.repository.warehouse(body.ma_kho)
            if not rows or rows[0]["trang_thai"] != 1:
                raise HTTPException(422, "Kho không tồn tại hoặc đã ngừng hoạt động.")
        rows = self.repository.update_employee(account["ma_nhan_vien"], {"loai_nhan_vien": body.role, "ma_kho": body.ma_kho})
        if not rows:
            raise HTTPException(404, "Không tìm thấy nhân viên.")
        return self.detail(account_id)

    def password(self, account_id: str, password: str, current_password: str | None = None):
        self.account(account_id)
        own = account_id == self.actor.account_id
        if own and current_password is None:
            raise HTTPException(409, "Đổi mật khẩu của bạn trong mục Tài khoản của tôi và xác nhận mật khẩu hiện tại.")
        expected_password = None
        expected_version = None
        if own:
            rows = self.repository.password_value(account_id)
            valid = bool(rows) and password_matches(current_password, rows[0]["mat_khau"])
            if not valid:
                raise HTTPException(422, "Mật khẩu hiện tại không đúng.")
            expected_password = rows[0]["mat_khau"]
            expected_version = rows[0]["phien_ban_mat_khau"]
        if not self.repository.set_password(account_id, password, expected_password, expected_version):
            raise HTTPException(409, "Tài khoản đã thay đổi. Tải lại và thử lại.")
        return self.detail(account_id)

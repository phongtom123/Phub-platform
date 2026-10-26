"""Account rules, explicit public projections and atomic new-person registration."""
import json
import re
from uuid import uuid4

from fastapi import HTTPException
from postgrest.exceptions import APIError
from pwdlib.exceptions import UnknownHashError

from ..auth import User, passwords
from .schemas import AccountCreate, AccountRead, AccountUpdate, NewAccountCreate, RoleUpdate

ACCOUNT_COLUMNS = "ma_tk,ten_tai_khoan,email,ma_nhan_vien,ma_kh,trang_thai"
EMPLOYEE_COLUMNS = "ma_nhan_vien,ho_ten,loai_nhan_vien,ma_kho,trang_thai"


def literal_search(query: str, fields: tuple[str, ...]) -> str:
    value = json.dumps(re.escape(query.strip()), ensure_ascii=False)
    return ",".join(f"{field}.imatch.{value}" for field in fields)


class Accounts:
    def __init__(self, db, actor: User):
        self.db, self.actor = db, actor

    def employee(self, employee_id: str) -> dict:
        rows = self.db.table("NHAN_VIEN").select(EMPLOYEE_COLUMNS).eq("ma_nhan_vien", employee_id).limit(1).execute().data
        if not rows:
            raise HTTPException(422, "Nhân viên không tồn tại.")
        return rows[0]

    def account(self, account_id: str) -> dict:
        rows = self.db.table("TAI_KHOAN").select(ACCOUNT_COLUMNS).eq("ma_tk", account_id).limit(1).execute().data
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
                rows = self.db.table("KHACH_HANG").select("ma_kh,ten_kh").eq("ma_kh", row["ma_kh"]).limit(1).execute().data
                if not rows:
                    raise HTTPException(422, "Hồ sơ khách hàng không tồn tại.")
                customer = rows[0]
            role, name, warehouse, active = "KHACH_HANG", customer["ten_kh"], None, True
        return AccountRead(**{key: row.get(key) for key in ACCOUNT_COLUMNS.split(",")},
                           role=role, ho_ten=name, ma_kho=warehouse, owner_active=active,
                           is_self=row["ma_tk"] == self.actor.account_id)

    def detail(self, account_id: str) -> AccountRead:
        return self.public(self.account(account_id))

    def page(self, page: int, page_size: int, q: str, status: int | None, role: str | None):
        # Embeds are allowlisted: no employee salary/CCCD, passwords or customer addresses.
        employee_join = "!inner" if role in {"ADMIN", "THU_KHO"} else ""
        projection = ACCOUNT_COLUMNS + f",employee:NHAN_VIEN{employee_join}({EMPLOYEE_COLUMNS}),customer:KHACH_HANG(ma_kh,ten_kh)"
        query = self.db.table("TAI_KHOAN").select(projection, count="exact")
        if q.strip():
            query = query.or_(literal_search(q, ("ma_tk", "ten_tai_khoan", "email")))
        if status is not None:
            query = query.eq("trang_thai", status)
        if role == "KHACH_HANG":
            query = query.not_.is_("ma_kh", "null")
        elif role:
            query = query.eq("employee.loai_nhan_vien", role)
        result = query.order("ma_tk").range((page - 1) * page_size, page * page_size - 1).execute()
        return {"data": [self.public(row, row.get("employee"), row.get("customer")) for row in result.data],
                "total": result.count or 0, "page": page, "page_size": page_size}

    def owners(self, kind: str, page: int, page_size: int, q: str):
        employee = kind == "employees"
        table = "NHAN_VIEN" if employee else "KHACH_HANG"
        key, name = ("ma_nhan_vien", "ho_ten") if employee else ("ma_kh", "ten_kh")
        columns = EMPLOYEE_COLUMNS if employee else "ma_kh,ten_kh"
        query = self.db.table(table).select(columns + ",account:TAI_KHOAN(ma_tk)", count="exact")
        if employee:
            query = query.eq("trang_thai", 1)
        if q.strip():
            query = query.or_(literal_search(q, (key, name)))
        result = query.order(key).range((page - 1) * page_size, page * page_size - 1).execute()
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
                warehouses = self.db.table("KHO").select("ma_kho,trang_thai").eq("ma_kho", profile["ma_kho"]).limit(1).execute().data
                if not warehouses or warehouses[0]["trang_thai"] != 1:
                    raise HTTPException(422, "Kho được phân công không hoạt động.")
        elif not self.db.table("KHACH_HANG").select("ma_kh").eq("ma_kh", owner).limit(1).execute().data:
            raise HTTPException(422, "Khách hàng không tồn tại.")
        if self.db.table("TAI_KHOAN").select("ma_tk").eq(field, owner).limit(1).execute().data:
            raise HTTPException(409, "Người này đã có tài khoản. Mỗi người chỉ được có một tài khoản.")
        # Unique constraints resolve concurrent creates; only one account row is written.
        values = body.model_dump(exclude={"password"}) | {"mat_khau_hash": passwords.hash(body.password), "trang_thai": 1}
        result = self.db.table("TAI_KHOAN").insert(values).execute().data
        if not result:
            raise RuntimeError("Account insert returned no rows")
        return self.detail(body.ma_tk)

    def create_new(self, body: NewAccountCreate):
        owner = body.new_owner
        owner_id = ("KH_" if owner.role == "KHACH_HANG" else "NV_") + uuid4().hex
        # Both inserts happen inside one PostgreSQL RPC transaction. Never leave
        # a new employee/customer behind when account uniqueness checks fail.
        try:
            result = self.db.rpc("admin_create_account_v1", {
                "p_actor_account_id": self.actor.account_id,
                "p_username": body.ten_tai_khoan,
                "p_email": body.email,
                "p_password_hash": passwords.hash(body.password),
                "p_owner_id": owner_id,
                "p_name": owner.ho_ten,
                "p_role": owner.role,
                "p_warehouse_id": owner.ma_kho,
            }).execute()
        except APIError as exc:
            if str(exc.code) == "PGRST202":
                raise HTTPException(503, "Chưa cài chức năng tạo tài khoản mới trong database. Cần chạy migration 20261010_admin_account_creation.sql.") from None
            if str(exc.code) == "42501":
                raise HTTPException(403, "Phiên quản trị không còn hợp lệ hoặc API chưa được cấp quyền gọi chức năng tạo tài khoản.") from None
            raise
        return AccountRead.model_validate(result.data)

    def update(self, account_id: str, body: AccountUpdate):
        self.account(account_id)
        rows = self.db.table("TAI_KHOAN").update(body.model_dump(exclude_unset=True)).eq("ma_tk", account_id).execute().data
        if not rows:
            raise HTTPException(404, "Không tìm thấy tài khoản.")
        return self.detail(account_id)

    def status(self, account_id: str, value: int):
        self.account(account_id)
        if account_id == self.actor.account_id and value != 1:
            raise HTTPException(409, "Không được khóa hoặc ẩn tài khoản đang đăng nhập.")
        self.db.table("TAI_KHOAN").update({"trang_thai": value}).eq("ma_tk", account_id).execute()
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
            rows = self.db.table("KHO").select("ma_kho,trang_thai").eq("ma_kho", body.ma_kho).limit(1).execute().data
            if not rows or rows[0]["trang_thai"] != 1:
                raise HTTPException(422, "Kho không tồn tại hoặc đã ngừng hoạt động.")
        # Role belongs to NHAN_VIEN, never a client-selected account column.
        rows = self.db.table("NHAN_VIEN").update({"loai_nhan_vien": body.role, "ma_kho": body.ma_kho}).eq("ma_nhan_vien", account["ma_nhan_vien"]).execute().data
        if not rows:
            raise HTTPException(404, "Không tìm thấy nhân viên.")
        return self.detail(account_id)

    def password(self, account_id: str, password: str, current_password: str | None = None):
        self.account(account_id)
        own = account_id == self.actor.account_id
        if own and current_password is None:
            raise HTTPException(409, "Đổi mật khẩu của bạn trong mục Tài khoản của tôi và xác nhận mật khẩu hiện tại.")
        query = self.db.table("TAI_KHOAN").update({"mat_khau_hash": passwords.hash(password)}).eq("ma_tk", account_id)
        if own:
            rows = self.db.table("TAI_KHOAN").select("mat_khau_hash").eq("ma_tk", account_id).limit(1).execute().data
            try:
                valid = bool(rows) and passwords.verify(current_password, rows[0]["mat_khau_hash"])
            except (ValueError, TypeError, UnknownHashError):
                valid = False
            if not valid:
                raise HTTPException(422, "Mật khẩu hiện tại không đúng.")
            # Compare-and-swap: a concurrent password change must not be overwritten.
            query = query.eq("mat_khau_hash", rows[0]["mat_khau_hash"])
        if not query.execute().data:
            raise HTTPException(409, "Tài khoản đã thay đổi. Tải lại và thử lại.")
        return self.detail(account_id)

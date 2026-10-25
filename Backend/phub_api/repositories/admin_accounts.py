"""Account persistence only; ownership/role/password decisions live in the service."""
import json
import re

ACCOUNT_COLUMNS = "ma_tk,ten_tai_khoan,email,ma_nhan_vien,ma_kh,trang_thai"
ACCOUNT_PROJECTION = ACCOUNT_COLUMNS + ",avatar:MEDIA!TAI_KHOAN_avatar_media_fkey(url)"
EMPLOYEE_COLUMNS = "ma_nhan_vien,ho_ten,loai_nhan_vien,ma_kho,trang_thai"


def literal_search(query: str, fields: tuple[str, ...]) -> str:
    value = json.dumps(re.escape(query.strip()), ensure_ascii=False)
    return ",".join(f"{field}.imatch.{value}" for field in fields)


class AccountsRepository:
    def __init__(self, client):
        self.client = client

    def employee(self, identifier):
        return self.client.table("NHAN_VIEN").select(EMPLOYEE_COLUMNS).eq("ma_nhan_vien", identifier).limit(1).execute().data

    def account(self, identifier):
        return self.client.table("TAI_KHOAN").select(ACCOUNT_PROJECTION).eq("ma_tk", identifier).limit(1).execute().data

    def customer(self, identifier):
        return self.client.table("KHACH_HANG").select("ma_kh,ten_kh").eq("ma_kh", identifier).limit(1).execute().data

    def warehouse(self, identifier):
        return self.client.table("KHO").select("ma_kho,trang_thai").eq("ma_kho", identifier).limit(1).execute().data

    def page(self, page, page_size, q, status, role):
        employee_join = "!inner" if role in {"ADMIN", "THU_KHO"} else ""
        projection = ACCOUNT_PROJECTION + f",employee:NHAN_VIEN{employee_join}({EMPLOYEE_COLUMNS}),customer:KHACH_HANG(ma_kh,ten_kh)"
        query = self.client.table("TAI_KHOAN").select(projection, count="exact")
        if q.strip():
            query = query.or_(literal_search(q, ("ma_tk", "ten_tai_khoan", "email")))
        if status is not None:
            query = query.eq("trang_thai", status)
        if role == "KHACH_HANG":
            query = query.not_.is_("ma_kh", "null")
        elif role:
            query = query.eq("employee.loai_nhan_vien", role)
        return query.order("ma_tk").range((page - 1) * page_size, page * page_size - 1).execute()

    def owners(self, kind, page, page_size, q):
        employee = kind == "employees"
        table = "NHAN_VIEN" if employee else "KHACH_HANG"
        key, name = ("ma_nhan_vien", "ho_ten") if employee else ("ma_kh", "ten_kh")
        columns = EMPLOYEE_COLUMNS if employee else "ma_kh,ten_kh"
        query = self.client.table(table).select(columns + ",account:TAI_KHOAN(ma_tk)", count="exact")
        if employee:
            query = query.eq("trang_thai", 1)
        if q.strip():
            query = query.or_(literal_search(q, (key, name)))
        return query.order(key).range((page - 1) * page_size, page * page_size - 1).execute()

    def owner_has_account(self, field, identifier):
        return bool(self.client.table("TAI_KHOAN").select("ma_tk").eq(field, identifier).limit(1).execute().data)

    def insert(self, values):
        return self.client.table("TAI_KHOAN").insert(values).execute().data

    def create_new(self, parameters):
        return self.client.rpc("admin_create_account_v2", parameters).execute().data

    def update(self, identifier, values):
        return self.client.table("TAI_KHOAN").update(values).eq("ma_tk", identifier).execute().data

    def update_employee(self, identifier, values):
        return self.client.table("NHAN_VIEN").update(values).eq("ma_nhan_vien", identifier).execute().data

    def password_value(self, identifier):
        return self.client.table("TAI_KHOAN").select("mat_khau,phien_ban_mat_khau").eq("ma_tk", identifier).limit(1).execute().data

    def set_password(self, identifier, value, expected_password=None, expected_version=None):
        # Keep passwords out of PostgREST URL filters/access logs.
        return self.client.rpc("set_account_password_v2", {
            "p_account_id": identifier, "p_password": value,
            "p_expected_password": expected_password,
            "p_expected_version": expected_version,
        }).execute().data

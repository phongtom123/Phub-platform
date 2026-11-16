"""Persisted identity lookups; authentication decisions belong to AuthService."""
from postgrest.exceptions import APIError

ACCOUNT_COLUMNS = "ma_tk,ten_tai_khoan,ma_kh,ma_nhan_vien,trang_thai,mat_khau,phien_ban_mat_khau,luu_tru_luc"
EMPLOYEE_COLUMNS = "ma_nhan_vien,ho_ten,loai_nhan_vien,ma_kho,trang_thai"
CUSTOMER_COLUMNS = "ma_kh,ten_kh,luu_tru_luc"
# One round trip per authenticated request: the linked employee/customer is
# embedded through the TAI_KHOAN foreign-key columns (hinted by column name).
ACCOUNT_WITH_PROFILE = (ACCOUNT_COLUMNS + f",employee:NHAN_VIEN!ma_nhan_vien({EMPLOYEE_COLUMNS})"
                        f",customer:KHACH_HANG!ma_kh({CUSTOMER_COLUMNS})")
# PostgREST relationship errors: fall back to separate lookups instead of failing auth.
EMBED_ERRORS = {"PGRST200", "PGRST201"}


class AuthRepository:
    def __init__(self, client):
        self.client = client

    def _account_by(self, field, value):
        try:
            return self.client.table("TAI_KHOAN").select(ACCOUNT_WITH_PROFILE).eq(field, value).limit(1).execute().data
        except APIError as exc:
            if exc.code not in EMBED_ERRORS:
                raise
            return self.client.table("TAI_KHOAN").select(ACCOUNT_COLUMNS).eq(field, value).limit(1).execute().data

    def account(self, identifier):
        return self._account_by("ma_tk", identifier)

    def login_account(self, field, value):
        return self._account_by(field, value)

    def employee(self, identifier):
        return self.client.table("NHAN_VIEN").select(EMPLOYEE_COLUMNS).eq("ma_nhan_vien", identifier).limit(1).execute().data

    def customer(self, identifier):
        return self.client.table("KHACH_HANG").select(CUSTOMER_COLUMNS).eq("ma_kh", identifier).limit(1).execute().data

    def register_customer(self, parameters):
        return self.client.rpc("customer_register_v2", parameters).execute().data

    def create_handoff(self, parameters):
        return self.client.rpc("auth_create_portal_handoff_v1", parameters).execute().data

    def consume_handoff(self, parameters):
        return self.client.rpc("auth_consume_portal_handoff_v1", parameters).execute().data

"""Persisted identity lookups; authentication decisions belong to AuthService."""
ACCOUNT_COLUMNS = "ma_tk,ten_tai_khoan,ma_kh,ma_nhan_vien,trang_thai,mat_khau_hash"


class AuthRepository:
    def __init__(self, client):
        self.client = client

    def account(self, identifier):
        return self.client.table("TAI_KHOAN").select(ACCOUNT_COLUMNS).eq("ma_tk", identifier).limit(1).execute().data

    def login_account(self, field, value):
        return self.client.table("TAI_KHOAN").select(ACCOUNT_COLUMNS).eq(field, value).limit(1).execute().data

    def employee(self, identifier):
        return self.client.table("NHAN_VIEN").select("ma_nhan_vien,ho_ten,loai_nhan_vien,ma_kho,trang_thai").eq("ma_nhan_vien", identifier).limit(1).execute().data

    def customer(self, identifier):
        return self.client.table("KHACH_HANG").select("ma_kh,ten_kh").eq("ma_kh", identifier).limit(1).execute().data

    def register_customer(self, parameters):
        return self.client.rpc("customer_register_v1", parameters).execute().data

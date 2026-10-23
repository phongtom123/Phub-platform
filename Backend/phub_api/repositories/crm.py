"""Bounded projections and atomic CRM writes through one PostgreSQL RPC."""
PROFILE_COLUMNS = "ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md,tinh_thanh_md,xa_phuong_md,ngay_sinh,ngay_tao,cap_nhat_luc,luu_tru_luc"


class CrmRepository:
    def __init__(self, db):
        self.db = db

    def profile(self, customer_id):
        return self.db.table("KHACH_HANG").select(PROFILE_COLUMNS).eq("ma_kh", customer_id).limit(1).execute().data

    def account(self, customer_id):
        return (self.db.table("TAI_KHOAN").select("ma_tk,ten_tai_khoan,email,trang_thai")
                .eq("ma_kh", customer_id).limit(1).execute().data)

    def update(self, customer_id, actor_id, changes):
        return self.db.rpc("admin_update_customer_profile_v2", {
            "p_customer_id": customer_id, "p_actor_account_id": actor_id,
            "p_changes": changes,
        }).execute().data

    def orders(self, customer_id, page, page_size):
        return (self.db.table("DON_HANG").select("ma_donhang,trang_thai,kenh_ban,thoi_gian_dat", count="exact")
                .eq("ma_kh", customer_id).order("thoi_gian_dat", desc=True).order("ma_donhang")
                .range((page - 1) * page_size, page * page_size - 1).execute())

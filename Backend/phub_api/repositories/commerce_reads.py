"""Ownership-scoped order/invoice reads; response construction lives in services."""
from postgrest.exceptions import APIError

from phub_api.repositories.pagination import rows

ORDER_COLUMNS = "ma_donhang,ma_kh,trang_thai,thoi_gian_dat,ten_nguoi_nhan,sdt_nguoi_nhan,dia_chi_chi_tiet,tinh_thanh,xa_phuong,ghi_chu"
LINE_COLUMNS = ("sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia::text,"
                "giam_gia::text,giam_gia_voucher::text,tien_thue::text,thanh_tien::text,owned_order:DON_HANG!inner(ma_donhang,ma_kh)")


class OrderReadRepository:
    def __init__(self, client):
        self.client = client

    def order_query(self, owner):
        return self.client.table("DON_HANG").select(ORDER_COLUMNS, count="exact").eq("ma_kh", owner)

    def find(self, order_id, owner):
        return self.order_query(owner).eq("ma_donhang", order_id).limit(1).execute().data

    def lines(self, order_id, owner):
        def query():
            return (self.client.table("CT_DON_HANG").select(LINE_COLUMNS)
                    .eq("ma_donhang", order_id).eq("owned_order.ma_kh", owner).order("ma_ct_donhang"))
        return rows(query)

    def page(self, owner, page, page_size):
        start = (page - 1) * page_size
        try:
            result = (self.order_query(owner).order("thoi_gian_dat", desc=True)
                      .order("ma_donhang", desc=True).range(start, start + page_size - 1).execute())
            return result.data, result.count
        except APIError as exc:
            if exc.code != "PGRST103":
                raise
            return [], self.client.table("DON_HANG").select("ma_donhang", count="exact", head=True).eq("ma_kh", owner).execute().count

    def invoice(self, order_id, owner):
        return (self.client.table("HOA_DON").select(
            "thoi_gian_lap,tong_tien_giam::text,tong_tien_truoc_thue::text,tong_tien_thue::text,tong_tien_sau_thue::text,owned_order:DON_HANG!inner(ma_donhang,ma_kh)"
        ).eq("ma_donhang", order_id).eq("owned_order.ma_kh", owner)
                .order("thoi_gian_lap", desc=True).order("ma_hoadon", desc=True).limit(1).execute().data)

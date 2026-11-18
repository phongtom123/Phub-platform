"""Read-only projections for the admin product & invoice statistics page."""
from phub_api.repositories.pagination import rows


class SalesAnalyticsRepository:
    def __init__(self, db, active_status=1):
        self.db = db
        self.active_status = active_status

    def products(self):
        return list(rows(lambda: self.db.table("SAN_PHAM").select(
            "sku,ten_sp,ma_loai_sp,thuong_hieu,gia_ban_hien_tai::text,trang_thai"
        ).order("sku")))

    def categories(self):
        return list(rows(lambda: self.db.table("LOAI_SP").select(
            "ma_loai_sp,ten_loai_sp,trang_thai"
        ).order("ma_loai_sp")))

    def stock(self, sku=None):
        """Physical stock in active warehouses only; optionally one SKU."""
        def query():
            q = (self.db.table("TON_KHO").select("sku,ma_kho,so_luong_ton,warehouse:KHO!inner(ten_kho,trang_thai)")
                 .eq("warehouse.trang_thai", self.active_status))
            return (q.eq("sku", sku) if sku is not None else q).order("ma_kho").order("sku")
        return list(rows(query))

    def reservations(self, statuses, sku=None):
        """Order lines of reserving orders with their invoice and successful THU payments as evidence."""
        def query():
            q = (self.db.table("CT_DON_HANG")
                 .select("sku,ma_kho_xuat,so_luong,order:DON_HANG!inner(trang_thai,invoice:HOA_DON(ma_donhang),payments:THANH_TOAN(ma_thanh_toan))")
                 .eq("order.payments.trang_thai", "THANH_CONG").eq("order.payments.loai_giao_dich", "THU")
                 .in_("order.trang_thai", list(statuses)))
            return (q.eq("sku", sku) if sku is not None else q).order("ma_ct_donhang")
        return list(rows(query))

    def product(self, sku):
        found = (self.db.table("SAN_PHAM")
                 .select("sku,ten_sp,ma_loai_sp,thuong_hieu,gia_ban_hien_tai::text,trang_thai,category:LOAI_SP(ten_loai_sp)")
                 .eq("sku", sku).limit(1).execute().data)
        return found[0] if found else None

    def product_sales(self, sku=None, start=None, end=None):
        """Lines of one SKU (or every SKU) on invoiced, non-cancelled orders, filtered by invoice time."""
        def query():
            q = (self.db.table("CT_DON_HANG")
                 .select("sku,ma_kho_xuat,ten_sp_luc_ban,so_luong,don_gia::text,giam_gia::text,giam_gia_voucher::text,"
                         "order:DON_HANG!inner(ma_donhang,trang_thai,kenh_ban,invoice:HOA_DON!inner(thoi_gian_lap))")
                 .neq("order.trang_thai", "HUY"))
            if sku is not None:
                q = q.eq("sku", sku)
            if start:
                q = q.gte("order.invoice.thoi_gian_lap", f"{start}T00:00:00+07:00")
            if end:
                q = q.lte("order.invoice.thoi_gian_lap", f"{end}T23:59:59.999999+07:00")
            return q.order("ma_ct_donhang")
        return list(rows(query))

    def invoices(self, start=None, end=None):
        """Invoices with their order, order lines and payments embedded: one round trip."""
        def query():
            q = self.db.table("HOA_DON").select(
                "ma_hoadon,ma_donhang,thoi_gian_lap,nguon_lap,tong_tien_giam::text,tong_tien_truoc_thue::text,"
                "tong_tien_thue::text,tong_tien_sau_thue::text,"
                "order:DON_HANG!inner(trang_thai,kenh_ban,"
                "lines:CT_DON_HANG(sku,ten_sp_luc_ban,so_luong,don_gia::text,giam_gia::text,giam_gia_voucher::text),"
                "payments:THANH_TOAN(so_tien::text,loai_giao_dich,phuong_thuc,trang_thai))"
            )
            if start:
                q = q.gte("thoi_gian_lap", f"{start}T00:00:00+07:00")
            if end:
                q = q.lte("thoi_gian_lap", f"{end}T23:59:59.999999+07:00")
            return q.order("ma_hoadon")
        return list(rows(query))

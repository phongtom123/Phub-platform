"""Read existing order/invoice tables with ownership applied to every query."""
from decimal import Decimal
from postgrest.exceptions import APIError

from ..catalog.availability import rows
from ..catalog.schemas import Pagination
from ..payments.errors import PaymentError
from .schemas import InvoiceOverview, OrderDetail, OrderPage, OrderSummary, StoredLine

ORDER_COLUMNS = "ma_donhang,ma_kh,trang_thai,thoi_gian_dat,ten_nguoi_nhan,sdt_nguoi_nhan,dia_chi_chi_tiet,tinh_thanh,xa_phuong,ghi_chu"
LINE_COLUMNS = ("sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia::text,"
                "giam_gia::text,giam_gia_voucher::text,tien_thue::text,thanh_tien::text,owned_order:DON_HANG!inner(ma_donhang,ma_kh)")
STATUSES = {"MOI", "XAC_NHAN", "DANG_CHUAN_BI", "DA_XUAT_KHO", "HOAN_THANH", "HUY"}


def missing():
    return PaymentError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng thuộc tài khoản của bạn.")


class OrderReader:
    def __init__(self, client, currency="VND"):
        self.client, self.currency = client, currency

    def order_query(self, owner):
        return self.client.table("DON_HANG").select(ORDER_COLUMNS, count="exact").eq("ma_kh", owner)

    def owned(self, order_id, owner):
        data = self.order_query(owner).eq("ma_donhang", order_id).limit(1).execute().data
        if len(data) != 1 or data[0]["ma_kh"] != owner or data[0]["ma_donhang"] != order_id:
            raise missing()
        return data[0]

    def lines(self, order_id, owner):
        def query():
            return (self.client.table("CT_DON_HANG").select(LINE_COLUMNS)
                    .eq("ma_donhang", order_id).eq("owned_order.ma_kh", owner).order("ma_ct_donhang"))
        result = []
        for row in rows(query):
            relation = row.get("owned_order", {})
            if relation.get("ma_kh") != owner or relation.get("ma_donhang") != order_id:
                raise missing()
            result.append(StoredLine(sku=row["sku"], warehouse_id=row["ma_kho_xuat"], name=row["ten_sp_luc_ban"],
                unit=row["don_vi_luc_ban"], quantity=row["so_luong"], unit_price=row["don_gia"],
                discount=Decimal(row["giam_gia"]) + Decimal(row["giam_gia_voucher"]),
                tax_amount=row["tien_thue"], line_total=row["thanh_tien"]))
        return result

    def summary(self, row, lines):
        return dict(id=row["ma_donhang"], status=row["trang_thai"] if row["trang_thai"] in STATUSES else "UNKNOWN",
                    created_at=row["thoi_gian_dat"], currency=self.currency,
                    total=sum((line.line_total for line in lines), Decimal(0)))

    def orders(self, owner, *, query=None, order_id=None):
        if order_id is not None:
            row = self.owned(order_id, owner)
            lines = self.lines(order_id, owner)
            return OrderDetail(**self.summary(row, lines), items=lines, note=row.get("ghi_chu"), recipient={
                "name": row.get("ten_nguoi_nhan"), "phone": row.get("sdt_nguoi_nhan"),
                "address_line": row.get("dia_chi_chi_tiet"), "province": row.get("tinh_thanh"), "ward": row.get("xa_phuong")})
        start = (query.page - 1) * query.page_size
        try:
            result = self.order_query(owner).order("thoi_gian_dat", desc=True).order("ma_donhang", desc=True).range(start, start + query.page_size - 1).execute()
            data, total = result.data, result.count
        except APIError as exc:
            if exc.code != "PGRST103":
                raise
            data = []
            total = self.client.table("DON_HANG").select("ma_donhang", count="exact", head=True).eq("ma_kh", owner).execute().count
        if not isinstance(total, int) or total < 0:
            raise RuntimeError("Missing order count")
        items = []
        for row in data:
            if row["ma_kh"] != owner:
                raise missing()
            items.append(OrderSummary(**self.summary(row, self.lines(row["ma_donhang"], owner))))
        return OrderPage(items=items, pagination=Pagination(page=query.page, page_size=query.page_size,
            total=total, total_pages=(total + query.page_size - 1) // query.page_size))

    def invoice(self, order_id, owner):
        self.owned(order_id, owner)
        data = (self.client.table("HOA_DON").select("thoi_gian_lap,tong_tien_giam::text,tong_tien_truoc_thue::text,tong_tien_thue::text,tong_tien_sau_thue::text,owned_order:DON_HANG!inner(ma_donhang,ma_kh)")
                .eq("ma_donhang", order_id).eq("owned_order.ma_kh", owner).order("thoi_gian_lap", desc=True).order("ma_hoadon", desc=True).limit(1).execute().data)
        invoice = None
        if data:
            row = data[0]
            relation = row.get("owned_order", {})
            if relation.get("ma_kh") != owner or relation.get("ma_donhang") != order_id:
                raise missing()
            invoice = dict(issued_at=row["thoi_gian_lap"], discount_total=row["tong_tien_giam"],
                           subtotal=row["tong_tien_truoc_thue"], tax_total=row["tong_tien_thue"], total=row["tong_tien_sau_thue"])
        return InvoiceOverview(order_id=order_id, currency=self.currency, invoice=invoice,
                               items=self.lines(order_id, owner) if invoice else [])

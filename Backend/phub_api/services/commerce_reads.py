from decimal import Decimal

from phub_api.models.errors import PaymentError
from phub_api.schemas.catalog import Pagination
from phub_api.schemas.commerce import InvoiceOverview, OrderDetail, OrderPage, OrderSummary, StoredLine

STATUSES = {"MOI", "XAC_NHAN", "DANG_CHUAN_BI", "DA_XUAT_KHO", "HOAN_THANH", "HUY"}


def missing():
    return PaymentError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng thuộc tài khoản của bạn.")


class OrderReadService:
    def __init__(self, repository, currency="VND"):
        self.repository, self.currency = repository, currency

    def owned(self, order_id, owner):
        data = self.repository.find(order_id, owner)
        if len(data) != 1 or data[0]["ma_kh"] != owner or data[0]["ma_donhang"] != order_id:
            raise missing()
        return data[0]

    def lines(self, order_id, owner):
        result = []
        for row in self.repository.lines(order_id, owner):
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
        data, total = self.repository.page(owner, query.page, query.page_size)
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
        data = self.repository.invoice(order_id, owner)
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

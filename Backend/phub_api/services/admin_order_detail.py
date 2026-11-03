from decimal import Decimal, InvalidOperation, localcontext

from fastapi import HTTPException

from phub_api.models.resources import RESOURCES, public_columns
from phub_api.repositories.tables import clean


def money(value):
    try:
        # Decimal columns are explicitly projected as text by TablesRepository.
        if not isinstance(value, str):
            raise ValueError
        amount = Decimal(value)
        if not amount.is_finite() or amount < 0 or amount != amount.quantize(Decimal("0.01")):
            raise ValueError
        return amount
    except (ValueError, InvalidOperation):
        raise HTTPException(409, "Số tiền của đơn không hợp lệ. Hãy đối chiếu dữ liệu thanh toán.") from None


def financial_summary(invoice, payments):
    with localcontext() as context:
        context.prec = 50
        collected = refunded = Decimal("0.00")
        for payment in payments:
            if payment.get("trang_thai") not in {"CHO_XU_LY", "THANH_CONG", "THAT_BAI"}:
                raise HTTPException(409, "Có giao dịch chưa xác định trạng thái.")
            if payment["trang_thai"] != "THANH_CONG":
                continue
            amount = money(payment.get("so_tien"))
            if payment.get("loai_giao_dich") == "THU":
                collected += amount
            elif payment.get("loai_giao_dich") == "HOAN_TIEN":
                refunded += amount
            else:
                raise HTTPException(409, "Có giao dịch chưa xác định loại thu/hoàn tiền.")
        paid = collected - refunded
        if paid < 0:
            raise HTTPException(409, "Tiền đã hoàn vượt số đã thu. Hãy đối chiếu lịch sử thanh toán.")
        total = money(invoice.get("tong_tien_sau_thue")) if invoice else None
        status = "CHUA_CO_HOA_DON" if total is None else (
            "THU_THUA" if paid > total else "DA_THU_DU" if paid == total else "CHUA_THU" if paid == 0 else "THU_MOT_PHAN")
        return {
            "invoice_id": invoice["ma_hoadon"] if invoice else None,
            "invoice_status": "DA_LAP" if invoice else "CHUA_LAP", "payment_status": status,
            "total": format(total, ".2f") if total is not None else None,
            "collected": format(collected, ".2f"), "refunded": format(refunded, ".2f"),
            "paid": format(paid, ".2f"),
            "remaining": format(max(Decimal(0), total - paid), ".2f") if total is not None else None,
        }


def public_row(name, row):
    allowed = {column["name"] for column in public_columns(name)}
    return {key: value for key, value in clean([row])[0].items() if key in allowed}


class AdminOrderDetailService:
    def __init__(self, repository, user):
        self.repository, self.user = repository, user

    def children(self, name, order_id):
        rows, keys, total = [], set(), None
        while total is None or len(rows) < total:
            page = self.repository.children_page(name, order_id, self.user, len(rows) // 100 + 1)
            if (type(page.count) is not int or page.count < 0 or
                    total is not None and page.count != total):
                raise HTTPException(409, "Dữ liệu đơn vừa thay đổi. Hãy tải lại chi tiết đơn.")
            total = page.count
            # Fail explicitly instead of returning a truncated financial history.
            if total > 100_000:
                raise HTTPException(409, "Đơn có quá nhiều dòng dữ liệu để tổng hợp. Hãy liên hệ quản trị hệ thống.")
            batch = page.data
            if len(batch) != min(100, total - len(rows)):
                raise HTTPException(409, "Dữ liệu đơn chưa đầy đủ. Hãy tải lại chi tiết đơn.")
            for row in batch:
                key = tuple(row.get(field) for field in RESOURCES[name].keys)
                if row.get("ma_donhang") != order_id or None in key or key in keys:
                    raise HTTPException(409, "Dữ liệu chi tiết đơn không hợp lệ hoặc bị trùng.")
                keys.add(key)
                rows.append(public_row(name, row))
        return rows

    def read(self, order_id):
        if self.user.role != "ADMIN":
            raise HTTPException(403, "Chỉ quản trị viên được xem tổng hợp chi tiết đơn.")
        if not order_id.strip():
            raise HTTPException(422, "Mã đơn hàng không được để trống.")
        orders = self.repository.order(order_id, self.user)
        if not orders:
            raise HTTPException(404, "Không tìm thấy đơn hàng.")
        order = public_row("orders", orders[0])
        if order.get("ma_donhang") != order_id:
            raise HTTPException(409, "Dữ liệu đơn hàng không hợp lệ.")
        lines = self.children("order-lines", order_id)
        invoices = self.children("invoices", order_id)
        if len(invoices) > 1:
            raise HTTPException(409, "Không xác định được hóa đơn duy nhất của đơn hàng.")
        invoice = invoices[0] if invoices else None
        payments = self.children("payments", order_id)
        vouchers = self.children("voucher-uses", order_id)
        customer = self.repository.customer(order.get("ma_kh"))
        employee = self.repository.employee(order.get("ma_nhan_vien"))
        return {
            "order_id": order_id, "order": order,
            "customer": {k: customer.get(k) for k in ("ma_kh", "ten_kh", "sdt")} if customer else None,
            "employee": {k: employee.get(k) for k in ("ma_nhan_vien", "ho_ten")} if employee else None,
            "lines": lines, "invoice": invoice, "payments": payments, "voucher_uses": vouchers,
            "financial": financial_summary(invoice, payments),
        }

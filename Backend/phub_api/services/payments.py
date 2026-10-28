from postgrest.exceptions import APIError

from phub_api.models.customer import CurrentCustomer
from phub_api.models.errors import PaymentError
from phub_api.schemas.catalog import Pagination
from phub_api.schemas.payments import PaymentOverview, PaymentTransaction, TransactionPage, TransactionQuery


TYPES = {"THU": "collection", "HOAN_TIEN": "refund"}
METHODS = {"TIEN_MAT": "cash", "CHUYEN_KHOAN": "bank_transfer", "THE": "card", "VI_DIEN_TU": "e_wallet"}
STATUSES = {"CHO_XU_LY": "pending", "THANH_CONG": "succeeded", "THAT_BAI": "failed"}


def not_found():
    return PaymentError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng thuộc tài khoản của bạn.")


def public_transaction(row) -> PaymentTransaction:
    if not isinstance(row, dict) or not isinstance(row.get("so_tien"), str):
        raise RuntimeError("Invalid payment amount representation")
    kind = TYPES.get(row.get("loai_giao_dich"), "unknown")
    status = STATUSES.get(row.get("trang_thai"), "unknown")
    label = {"collection": "Khoản thu", "refund": "Khoản hoàn tiền", "unknown": "Giao dịch"}[kind]
    message = {
        "pending": f"{label} đang chờ xử lý; chưa được xác nhận thành công.",
        "succeeded": f"{label} đã được ghi nhận thành công.",
        "failed": f"{label} xử lý thất bại.",
        "unknown": f"{label} có trạng thái chưa xác định; cần được xác nhận lại.",
    }[status]
    return PaymentTransaction(
        type=kind, method=METHODS.get(row.get("phuong_thuc"), "unknown"),
        amount=row["so_tien"], status=status, occurred_at=row.get("thoi_gian"), message=message,
    )


class PaymentService:
    def __init__(self, repository, payment_requests=None):
        self.repository, self.currency = repository, repository.currency
        self.payment_requests = payment_requests

    def request(self, order_id, customer, method, key):
        self.require_owned_order(order_id, customer)
        if self.payment_requests is None:
            raise RuntimeError("Payment request provider is not configured")
        return self.payment_requests.request(order_id, customer, method, key)

    def require_owned_order(self, order_id, customer: CurrentCustomer):
        if not isinstance(customer, CurrentCustomer):
            raise PaymentError(503, "AUTH_INTEGRATION_REQUIRED", "Phần xác thực chưa cung cấp khách hàng đã được xác minh.")
        rows = self.repository.owned_order(order_id, customer.customer_id)
        if not rows:
            raise not_found()
        if len(rows) != 1 or rows[0].get("ma_donhang") != order_id or rows[0].get("ma_kh") != customer.customer_id:
            raise not_found()

    def public_rows(self, rows, order_id, customer):
        if not isinstance(rows, list):
            raise RuntimeError("Invalid payment rows")
        for row in rows:
            owner = row.get("owned_order") if isinstance(row, dict) else None
            if not isinstance(owner, dict):
                raise RuntimeError("Missing payment ownership relation")
            if owner.get("ma_donhang") != order_id or owner.get("ma_kh") != customer.customer_id:
                raise not_found()
        return [public_transaction(row) for row in rows]

    def overview(self, order_id, customer: CurrentCustomer):
        self.require_owned_order(order_id, customer)
        rows = self.repository.latest(order_id, customer)
        items = self.public_rows(rows, order_id, customer)
        if len(items) > 1:
            raise RuntimeError("Invalid latest payment result")
        latest = items[0] if items else None
        return PaymentOverview(
            order_id=order_id, currency=self.currency, latest_transaction=latest,
            message=latest.message if latest else "Đơn hàng chưa có giao dịch thanh toán được ghi nhận; chưa thể kết luận đã thanh toán.",
        )

    def history(self, order_id, customer: CurrentCustomer, query: TransactionQuery):
        self.require_owned_order(order_id, customer)
        offset = (query.page - 1) * query.page_size
        try:
            result = self.repository.page(order_id, customer, query.page, query.page_size)
            rows, total = result.data, result.count
        except APIError as exc:
            if exc.code != "PGRST103":
                raise
            total = self.repository.count(order_id, customer)
            rows = []
        if not isinstance(total, int) or total < 0:
            raise RuntimeError("Missing payment count")
        items = self.public_rows(rows, order_id, customer)
        if len(items) > query.page_size or len(items) > max(0, total - offset):
            raise RuntimeError("Invalid payment pagination")
        return TransactionPage(
            order_id=order_id, currency=self.currency, items=items,
            pagination=Pagination(page=query.page, page_size=query.page_size, total=total,
                                  total_pages=(total + query.page_size - 1) // query.page_size),
        )

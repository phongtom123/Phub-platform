from phub_api.models.errors import PaymentError
from phub_api.schemas.payments import PaymentOverview, TransactionPage


class UnconnectedPaymentRequests:
    def request(self, order_id, customer, method, key):
        raise PaymentError(503, "PAYMENT_INTEGRATION_REQUIRED", "Chức năng thực hiện thanh toán chưa được kết nối. Chưa ghi nhận thanh toán.")


DEMO_ERRORS = {
    "ORDER_NOT_FOUND": (404, "Không tìm thấy đơn hàng thuộc tài khoản của bạn."),
    "ORDER_NOT_PAYABLE": (409, "Chỉ dùng đơn ONLINE mới, chưa có hóa đơn hoặc giao dịch thật để thử nghiệm."),
    "PAYMENT_ALREADY_PENDING": (409, "Đơn đang có yêu cầu thanh toán giả lập chờ xử lý."),
    "ORDER_ALREADY_PAID": (409, "Đơn đã mô phỏng thanh toán thành công."),
    "IDEMPOTENCY_CONFLICT": (409, "Lần yêu cầu thanh toán có nội dung khác."),
    "VALIDATION_ERROR": (422, "Thông tin thanh toán giả lập không hợp lệ."),
}


class DemoPaymentRequests(UnconnectedPaymentRequests):
    """Money stays in a separate demo ledger; only order preparation is simulated."""

    def __init__(self, repository, settings):
        self.repository, self.settings = repository, settings

    def allowed(self, customer):
        return self.settings.permits(customer.customer_id)

    def call(self, order_id, customer, action, **kwargs):
        result = self.repository.demo(order_id, customer, action, **kwargs)
        if not isinstance(result, dict):
            raise RuntimeError("Invalid demo payment result")
        if "error" in result:
            code = result["error"]
            if code not in DEMO_ERRORS:
                raise RuntimeError("Unknown demo payment error")
            status, message = DEMO_ERRORS[code]
            raise PaymentError(status, code, message)
        return result

    def request(self, order_id, customer, method, key):
        if not self.allowed(customer):
            return super().request(order_id, customer, method, key)
        result = self.call(order_id, customer, "request", key=key, method=method)
        return PaymentOverview.model_validate(result["overview"]), result["replayed"]

    def overview(self, order_id, customer):
        if not self.allowed(customer):
            return None
        result = self.call(order_id, customer, "read")
        return PaymentOverview.model_validate(result["overview"]) if result.get("overview") else None

    def history(self, order_id, customer, query):
        if not self.allowed(customer):
            return None
        result = self.call(order_id, customer, "history", page=query.page, page_size=query.page_size)
        return TransactionPage.model_validate(result["history"]) if result.get("history") else None

from .errors import OrderError
from .schemas import CreateOrder, OrderReceipt
from .settings import OrderSettings
from ..commerce.rpc import checkout_parameters
from ..payments.auth import CurrentCustomer
from ..payments.errors import PaymentError


PUBLIC_ERRORS = {
    "VALIDATION_ERROR": (422, "Thông tin đặt hàng không hợp lệ."),
    "PRODUCT_NOT_AVAILABLE": (404, "Sản phẩm không tồn tại hoặc không còn được bán."),
    "WAREHOUSE_NOT_AVAILABLE": (404, "Kho không tồn tại hoặc không hoạt động."),
    "PRICE_CHANGED": (409, "Giá sản phẩm đã thay đổi. Vui lòng kiểm tra và xác nhận lại."),
    "INSUFFICIENT_STOCK": (409, "Kho không đủ hàng cho số lượng yêu cầu."),
    "IDEMPOTENCY_CONFLICT": (409, "Idempotency-Key đã được dùng cho nội dung đặt hàng khác."),
    "AMOUNT_OUT_OF_RANGE": (422, "Số tiền vượt phạm vi được hỗ trợ."),
    "ORDER_CONFIGURATION_REQUIRED": (503, "Chưa có cấu hình đặt hàng phù hợp với quy tắc của nhóm."),
    "AUTH_CUSTOMER_UNAVAILABLE": (403, "Tài khoản chưa liên kết khách hàng hợp lệ."),
    "CHECKOUT_CHANGED": (409, "Tổng tiền đã thay đổi. Vui lòng kiểm tra và xác nhận lại."),
}


class OrderRepository:
    def __init__(self, client, settings=None):
        self.client, self.settings = client, settings

    def create(self, order: CreateOrder, key, customer: CurrentCustomer):
        if not isinstance(customer, CurrentCustomer):
            raise PaymentError(503, "AUTH_INTEGRATION_REQUIRED", "Chưa có khách hàng đã được xác minh.")
        settings = self.settings or OrderSettings.from_env()
        # Keep the original body/receipt for clients without vouchers, but require
        # verified ownership and use the same atomic v2 engine as customer checkout.
        payload = order.canonical_payload()
        payload.update(voucher_code=None, expected_discount="0.00",
                       expected_total=format(sum(item.expected_unit_price * item.quantity for item in order.items), ".2f"))
        result = self.client.rpc("customer_checkout_v2", checkout_parameters(payload, customer, create=True, key=key, settings=settings)).execute().data
        if not isinstance(result, dict):
            raise RuntimeError("Invalid order RPC response")
        if "error" in result:
            code = result["error"].get("code") if isinstance(result["error"], dict) else None
            if code not in PUBLIC_ERRORS:
                raise RuntimeError("Unknown order RPC error")
            status, message = PUBLIC_ERRORS[code]
            raise OrderError(status, code, message)
        if not isinstance(result.get("replayed"), bool):
            raise RuntimeError("Missing replay flag")
        return OrderReceipt.model_validate(result["order"]), result["replayed"]

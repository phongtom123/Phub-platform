from fastapi import APIRouter

from phub_api.controllers import payments
from phub_api.middleware.payment_errors import PaymentRoute
from phub_api.schemas.payments import PaymentOverview, TransactionPage
from phub_api.api.responses import documented_error

ERRORS = {
    401: documented_error("AUTHENTICATION_REQUIRED", "Cần đăng nhập bằng phiên PHUB hợp lệ."),
    403: documented_error("ACCESS_DENIED", "Tài khoản không được phép truy cập."),
    404: documented_error("ORDER_NOT_FOUND", "Đơn không tồn tại hoặc không thuộc khách hàng; cùng một phản hồi."),
    422: documented_error("VALIDATION_ERROR", "Mã đơn hoặc tham số truy vấn không hợp lệ."),
    500: documented_error("INTERNAL_ERROR", "Không thể tra cứu thanh toán."),
    503: documented_error("PAYMENT_SCHEMA_NOT_READY", "Schema/cấu hình thanh toán chưa sẵn sàng hoặc dịch vụ dữ liệu không khả dụng."),
}

router = APIRouter(prefix="/api/orders", tags=["Customer Payments"], route_class=PaymentRoute)

router.get("/{order_id}/payments", response_model=PaymentOverview, responses=ERRORS,
            summary="Xem giao dịch thanh toán mới nhất của đơn thuộc khách")(payments.payment_overview)

router.get("/{order_id}/transactions", response_model=TransactionPage, responses=ERRORS,
            summary="Lịch sử thu và hoàn tiền của đơn thuộc khách")(payments.transaction_history)

router.post("/{order_id}/payment-request", response_model=PaymentOverview, responses={409: documented_error("IDEMPOTENCY_CONFLICT", "Lần thanh toán có nội dung khác hoặc đang được xử lý."), **ERRORS},
             summary="Điểm nối yêu cầu thanh toán cho đơn thuộc khách")(payments.request_order_payment)

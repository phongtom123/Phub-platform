from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response

from phub_api.dependencies.customer import require_customer
from phub_api.dependencies.payments import get_service
from phub_api.middleware.payment_errors import PaymentError, PaymentRoute
from phub_api.models.customer import CurrentCustomer
from phub_api.schemas.payments import (
    NoQuery,
    OrderId,
    PaymentOverview,
    PaymentRequest,
    TransactionPage,
    TransactionQuery,
)
from phub_api.schemas.responses import documented_error
from phub_api.services.payments import PaymentService


ERRORS = {
    401: documented_error("AUTHENTICATION_REQUIRED", "Cần đăng nhập bằng phiên PHUB hợp lệ."),
    403: documented_error("ACCESS_DENIED", "Tài khoản không được phép truy cập."),
    404: documented_error("ORDER_NOT_FOUND", "Đơn không tồn tại hoặc không thuộc khách hàng; cùng một phản hồi."),
    422: documented_error("VALIDATION_ERROR", "Mã đơn hoặc tham số truy vấn không hợp lệ."),
    500: documented_error("INTERNAL_ERROR", "Không thể tra cứu thanh toán."),
    503: documented_error("PAYMENT_SCHEMA_NOT_READY", "Schema/cấu hình thanh toán chưa sẵn sàng hoặc dịch vụ dữ liệu không khả dụng."),
}

router = APIRouter(prefix="/api/orders", tags=["Customer Payments"], route_class=PaymentRoute)

@router.get("/{order_id}/payments", response_model=PaymentOverview, responses=ERRORS,
            summary="Xem giao dịch thanh toán mới nhất của đơn thuộc khách")
def payment_overview(
    order_id: OrderId,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    service: Annotated[PaymentService, Depends(get_service)],
    query: Annotated[NoQuery, Query()],
):
    return service.overview(order_id, customer)


@router.get("/{order_id}/transactions", response_model=TransactionPage, responses=ERRORS,
            summary="Lịch sử thu và hoàn tiền của đơn thuộc khách")
def transaction_history(
    order_id: OrderId,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    service: Annotated[PaymentService, Depends(get_service)],
    query: Annotated[TransactionQuery, Query()],
):
    return service.history(order_id, customer, query)


@router.post("/{order_id}/payment-request", response_model=PaymentOverview, responses={409: documented_error("IDEMPOTENCY_CONFLICT", "Lần thanh toán có nội dung khác hoặc đang được xử lý."), **ERRORS},
             summary="Điểm nối yêu cầu thanh toán cho đơn thuộc khách")
def request_order_payment(order_id: OrderId, request: PaymentRequest, response: Response,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    service: Annotated[PaymentService, Depends(get_service)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36)]):
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError()
    except ValueError:
        raise PaymentError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.") from None
    result, replayed = service.request(order_id, customer, request.method, key)
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    return result

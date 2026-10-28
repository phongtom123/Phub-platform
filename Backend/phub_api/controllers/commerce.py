from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response

from phub_api.dependencies.commerce import get_service
from phub_api.dependencies.customer import require_customer
from phub_api.middleware.commerce_errors import CommerceRoute
from phub_api.middleware.payment_errors import PaymentError
from phub_api.models.customer import CurrentCustomer
from phub_api.schemas.commerce import (
    CheckoutQuote,
    CustomerOrderReceipt,
    CustomerOrderRequest,
    CustomerProfile,
    InvoiceOverview,
    OrderDetail,
    OrderPage,
    OrderQuery,
    QuoteRequest,
)
from phub_api.schemas.orders import Recipient
from phub_api.schemas.payments import NoQuery, OrderId
from phub_api.schemas.responses import documented_error
from phub_api.services.commerce import CommerceService


ERRORS = {
    401: documented_error("AUTHENTICATION_REQUIRED", "Cần đăng nhập bằng phiên PHUB hợp lệ."),
    403: documented_error("ACCESS_DENIED", "Tài khoản không có quyền hoặc không liên kết khách."),
    404: documented_error("ORDER_NOT_FOUND", "Đơn không tồn tại/không thuộc khách, hoặc sản phẩm/kho không khả dụng."),
    409: documented_error("CHECKOUT_CHANGED", "Giá/tồn kho/voucher thay đổi, hết lượt hoặc yêu cầu idempotent xung đột."),
    422: documented_error("VALIDATION_ERROR", "Mã đơn, giỏ hàng, người nhận hoặc query không hợp lệ."),
    500: documented_error("INTERNAL_ERROR", "Không thể xử lý yêu cầu."),
    503: documented_error("CHECKOUT_DATABASE_NOT_READY", "Migration/cấu hình checkout hoặc dịch vụ dữ liệu chưa sẵn sàng."),
}

router = APIRouter(prefix="/api/customer", tags=["Customer Shopping"], route_class=CommerceRoute)

Customer = Annotated[CurrentCustomer, Depends(require_customer)]


Service = Annotated[CommerceService, Depends(get_service)]


@router.get("/me", response_model=CustomerProfile, responses=ERRORS, summary="Hồ sơ khách đang đăng nhập")
def current_profile(customer: Customer, service: Service, query: Annotated[NoQuery, Query()]):
    return service.profile(customer)


@router.put("/me", response_model=CustomerProfile, responses=ERRORS, summary="Lưu thông tin nhận hàng của khách hiện tại")
def save_current_profile(request: Recipient, customer: Customer, service: Service, query: Annotated[NoQuery, Query()]):
    return service.save_profile(request, customer)


@router.post("/checkout/quote", response_model=CheckoutQuote, responses=ERRORS, summary="Báo giá giỏ hàng và kiểm tra voucher")
def quote_checkout(request: QuoteRequest, customer: Customer, service: Service):
    return service.quote(request, customer)


@router.post("/orders", response_model=CustomerOrderReceipt, status_code=201,
             responses={200: {"model": CustomerOrderReceipt, "description": "Replay của cùng khách/key/nội dung."}, **ERRORS},
             summary="Đặt đơn thuộc khách với voucher và idempotency")
def create_customer_order(request: CustomerOrderRequest, customer: Customer, service: Service, response: Response,
                          idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36)]):
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError("UUID v4 required")
    except ValueError:
        raise PaymentError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.") from None
    receipt, replayed = service.create(request, customer, key)
    response.status_code = 200 if replayed else 201
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    return receipt


@router.get("/orders", response_model=OrderPage, responses=ERRORS, summary="Danh sách đơn thuộc khách")
def list_orders(customer: Customer, service: Service, query: Annotated[OrderQuery, Query()]):
    return service.orders(customer, query=query)


@router.get("/orders/{order_id}", response_model=OrderDetail, responses=ERRORS, summary="Chi tiết đơn thuộc khách")
def order_detail(order_id: OrderId, customer: Customer, service: Service, query: Annotated[NoQuery, Query()]):
    return service.orders(customer, order_id=order_id)


@router.get("/orders/{order_id}/invoice", response_model=InvoiceOverview, responses=ERRORS, summary="Hóa đơn công khai của đơn thuộc khách")
def order_invoice(order_id: OrderId, customer: Customer, service: Service, query: Annotated[NoQuery, Query()]):
    return service.invoice(order_id, customer)

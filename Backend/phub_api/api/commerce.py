from fastapi import APIRouter

from phub_api.controllers import commerce
from phub_api.middleware.commerce_errors import CommerceRoute
from phub_api.schemas.commerce import CheckoutQuote, CustomerOrderReceipt, CustomerProfile, InvoiceOverview, OrderDetail, OrderPage
from phub_api.api.responses import documented_error

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

router.get("/me", response_model=CustomerProfile, responses=ERRORS, summary="Hồ sơ khách đang đăng nhập")(commerce.current_profile)

router.put("/me", response_model=CustomerProfile, responses=ERRORS, summary="Lưu thông tin nhận hàng của khách hiện tại")(commerce.save_current_profile)

router.post("/checkout/quote", response_model=CheckoutQuote, responses=ERRORS, summary="Báo giá giỏ hàng và kiểm tra voucher")(commerce.quote_checkout)

router.post("/orders", response_model=CustomerOrderReceipt, status_code=201,
             responses={200: {"model": CustomerOrderReceipt, "description": "Replay của cùng khách/key/nội dung."}, **ERRORS},
             summary="Đặt đơn thuộc khách với voucher và idempotency")(commerce.create_customer_order)

router.get("/orders", response_model=OrderPage, responses=ERRORS, summary="Danh sách đơn thuộc khách")(commerce.list_orders)

router.get("/orders/{order_id}", response_model=OrderDetail, responses=ERRORS, summary="Chi tiết đơn thuộc khách")(commerce.order_detail)

router.get("/orders/{order_id}/invoice", response_model=InvoiceOverview, responses=ERRORS, summary="Hóa đơn công khai của đơn thuộc khách")(commerce.order_invoice)

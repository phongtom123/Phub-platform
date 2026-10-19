from fastapi import APIRouter

from phub_api.controllers import orders
from phub_api.middleware.order_errors import OrderRoute
from phub_api.schemas.orders import OrderReceipt
from phub_api.api.responses import documented_error

router = APIRouter(prefix="/api/orders", tags=["Customer Orders"], route_class=OrderRoute)

router.post(
    "", response_model=OrderReceipt, status_code=201,
    summary="Đặt đơn ONLINE từ các SKU và kho còn hàng",
    responses={
        200: {"model": OrderReceipt, "description": "Trả lại kết quả cũ khi cùng key và cùng nội dung; không tạo đơn mới."},
        401: documented_error("AUTHENTICATION_REQUIRED", "Cần đăng nhập để đặt đơn."),
        403: documented_error("ACCESS_DENIED", "Tài khoản không liên kết khách hợp lệ."),
        404: documented_error("PRODUCT_NOT_AVAILABLE", "Sản phẩm hoặc kho không khả dụng."),
        409: documented_error("INSUFFICIENT_STOCK", "Thiếu hàng, giá thay đổi, key khác nội dung hoặc xung đột đồng thời."),
        422: documented_error("VALIDATION_ERROR", "Thông tin đặt hàng không hợp lệ."),
        500: documented_error("INTERNAL_ERROR", "Không thể xử lý yêu cầu đặt hàng."),
        503: documented_error("ORDER_CONFIGURATION_REQUIRED", "Thiếu cấu hình, migration hoặc dịch vụ dữ liệu không khả dụng."),
    },
)(orders.create_order)

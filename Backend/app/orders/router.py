from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response

from ..catalog.router import documented_error
from ..catalog.schemas import ErrorDetail
from .errors import OrderError, OrderRoute
from .repository import OrderRepository
from .schemas import CreateOrder, OrderReceipt
from ..payments.auth import CurrentCustomer, require_customer


router = APIRouter(prefix="/api/orders", tags=["Customer Orders"], route_class=OrderRoute)


def get_repository():
    from ..supabase import supabase
    return OrderRepository(supabase)


@router.post(
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
)
def create_order(
    order: CreateOrder, response: Response,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36, description="UUID v4 mới cho một lần đặt; giữ nguyên key khi retry.", examples=["0672b8b1-86ea-4f51-8668-1c722b8a9d99"])],
    repository: Annotated[OrderRepository, Depends(get_repository)],
):
    """Khách đã xác thực, chưa thanh toán. Server chốt giá trước thuế, tên và đơn vị.
    Body cũ không có voucher được giữ; ma_kh lấy từ xác thực, dùng RPC checkout v2.
    Chưa nối xác thực trả 503 AUTH_INTEGRATION_REQUIRED. Checkout có voucher dùng
    POST /api/customer/orders. RPC v1 cũ không được dùng để tạo đơn qua HTTP nữa.
    Thuế suất chốt 10%; tiền thuế đơn = 0.00, chỉ áp dụng khi nhóm lập hóa đơn.
    Tồn khả dụng = tồn thực trừ lượng của các đơn MOI/XAC_NHAN/DANG_CHUAN_BI.
    Đơn tạo ở trạng thái MOI; không trừ TON_KHO trong endpoint này.
    RPC/migration và cấu hình thuế/kho phải được nhóm xác nhận trước khi sử dụng.
    Đổi thứ tự dòng hoặc cách ghi giá 10/10.00 không làm đổi nội dung idempotent.
    Không nhận mã khách hàng/nhân viên, giá bán thực tế, thuế hay tổng tiền từ client.
    """
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError("Not UUID v4")
    except ValueError:
        raise OrderError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.", [ErrorDetail(field="Idempotency-Key", message="Phải là UUID v4.")]) from None
    receipt, replayed = repository.create(order, key, customer)
    response.status_code = 200 if replayed else 201
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    response.headers["Cache-Control"] = "no-store"
    return receipt

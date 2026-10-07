import os
import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response

from ..catalog.router import documented_error
from .auth import CurrentCustomer, require_customer
from .errors import PaymentError, PaymentRoute
from .repository import PaymentRepository
from .schemas import NoQuery, OrderId, PaymentOverview, TransactionPage, TransactionQuery
from .requests import PaymentRequest, get_payment_requests


router = APIRouter(prefix="/api/orders", tags=["Customer Payments"], route_class=PaymentRoute)


def get_repository():
    from ..supabase import supabase
    currency = os.getenv("CATALOG_CURRENCY", "VND")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise PaymentError(503, "PAYMENT_CONFIGURATION_REQUIRED", "Cấu hình tiền tệ thanh toán chưa hợp lệ.")
    return PaymentRepository(supabase, currency)


ERRORS = {
    401: documented_error("AUTHENTICATION_REQUIRED", "Cần đăng nhập, sau khi nhóm kết nối dependency xác thực."),
    403: documented_error("ACCESS_DENIED", "Tài khoản không được phép truy cập."),
    404: documented_error("ORDER_NOT_FOUND", "Đơn không tồn tại hoặc không thuộc khách hàng; cùng một phản hồi."),
    422: documented_error("VALIDATION_ERROR", "Mã đơn hoặc tham số truy vấn không hợp lệ."),
    500: documented_error("INTERNAL_ERROR", "Không thể tra cứu thanh toán."),
    503: documented_error("AUTH_INTEGRATION_REQUIRED", "Chưa nối xác thực, schema/cấu hình chưa sẵn sàng hoặc dịch vụ dữ liệu không khả dụng."),
}


@router.get("/{order_id}/payments", response_model=PaymentOverview, responses=ERRORS,
            summary="Xem giao dịch thanh toán mới nhất của đơn thuộc khách")
def payment_overview(
    order_id: OrderId,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    repository: Annotated[PaymentRepository, Depends(get_repository)],
    query: Annotated[NoQuery, Query()],
):
    """Chỉ đọc, không tạo hay cập nhật giao dịch/hóa đơn. Đơn thuộc khách đã xác thực.

    Hiện dependency xác thực chưa được tích hợp: mọi yêu cầu trả 503
    AUTH_INTEGRATION_REQUIRED, kể cả gửi Authorization hoặc ma_kh tự khai báo.
    Khi nhóm nối xác thực, trả phương thức, số tiền và trạng thái giao dịch mới nhất
    (thu hoặc hoàn tiền). Không suy diễn đã tất toán toàn đơn từ một giao dịch.
    Chưa có giao dịch trả latest_transaction=null, không giả định đã thanh toán.
    Tiền dùng dữ liệu THANH_TOAN, không tự tính hoặc cộng thuế 10% lần nữa.
    """
    return repository.overview(order_id, customer)


@router.get("/{order_id}/transactions", response_model=TransactionPage, responses=ERRORS,
            summary="Lịch sử thu và hoàn tiền của đơn thuộc khách")
def transaction_history(
    order_id: OrderId,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    repository: Annotated[PaymentRepository, Depends(get_repository)],
    query: Annotated[TransactionQuery, Query()],
):
    """Phân trang 1–100 dòng, mới nhất trước; thời gian bằng nhau sắp theo khóa nội bộ.
    Không trả khóa thanh toán, mã giao dịch nhà cung cấp hay payload nhạy cảm.
    CHO_XU_LY -> pending với thông báo chưa xác nhận thành công.
    THANH_CONG -> succeeded; THAT_BAI -> failed; giá trị mới -> unknown.
    Chưa tích hợp xác thực sẽ trả 503, không có chế độ tra cứu công khai theo mã đơn.
    """
    return repository.history(order_id, customer, query)


@router.post("/{order_id}/payment-request", response_model=PaymentOverview, responses={409: documented_error("IDEMPOTENCY_CONFLICT", "Lần thanh toán có nội dung khác hoặc đang được xử lý."), **ERRORS},
             summary="Điểm nối yêu cầu thanh toán cho đơn thuộc khách")
def request_order_payment(order_id: OrderId, request: PaymentRequest, response: Response,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    repository: Annotated[PaymentRepository, Depends(get_repository)],
    service: Annotated[object, Depends(get_payment_requests)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36)]):
    """Chỉ nhận phương thức, không nhận số tiền hoặc mã giao dịch từ trình duyệt.
    Execution production CHƯA kết nối: trả 503 PAYMENT_INTEGRATION_REQUIRED,
    không ghi Supabase/thu tiền. Backend fixture riêng mô phỏng pending/idempotency.
    Không cho khách tự xác nhận thanh toán thành công.
    """
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError()
    except ValueError:
        raise PaymentError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.") from None
    repository.require_owned_order(order_id, customer)
    result, replayed = service.request(order_id, customer, request.method, key)
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    return result

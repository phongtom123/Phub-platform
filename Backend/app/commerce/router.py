from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response

from ..catalog.router import documented_error
from ..payments.auth import CurrentCustomer, require_customer
from ..payments.errors import PaymentError
from ..payments.schemas import NoQuery, OrderId
from ..orders.schemas import Recipient
from .errors import CommerceRoute
from .repository import CommerceRepository
from .schemas import CheckoutQuote, CustomerOrderReceipt, CustomerOrderRequest, CustomerProfile, InvoiceOverview, OrderDetail, OrderPage, OrderQuery, QuoteRequest


router = APIRouter(prefix="/api/customer", tags=["Customer Shopping"], route_class=CommerceRoute)
Customer = Annotated[CurrentCustomer, Depends(require_customer)]


def get_repository():
    from ..supabase import supabase
    return CommerceRepository(supabase)


Repository = Annotated[CommerceRepository, Depends(get_repository)]
ERRORS = {
    401: documented_error("AUTHENTICATION_REQUIRED", "Cần đăng nhập bằng module xác thực của nhóm."),
    403: documented_error("ACCESS_DENIED", "Tài khoản không có quyền hoặc không liên kết khách."),
    404: documented_error("ORDER_NOT_FOUND", "Đơn không tồn tại/không thuộc khách, hoặc sản phẩm/kho không khả dụng."),
    409: documented_error("CHECKOUT_CHANGED", "Giá/tồn kho/voucher thay đổi, hết lượt hoặc yêu cầu idempotent xung đột."),
    422: documented_error("VALIDATION_ERROR", "Mã đơn, giỏ hàng, người nhận hoặc query không hợp lệ."),
    500: documented_error("INTERNAL_ERROR", "Không thể xử lý yêu cầu."),
    503: documented_error("AUTH_INTEGRATION_REQUIRED", "Chưa nối xác thực/migration hoặc dịch vụ dữ liệu chưa sẵn sàng."),
}


@router.get("/me", response_model=CustomerProfile, responses=ERRORS, summary="Hồ sơ khách đang đăng nhập")
def current_profile(customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    """Chỉ đọc KHACH_HANG của danh tính đã xác minh; không tạo/sửa tài khoản.
    Điểm nối require_customer mặc định trả 503 cho đến khi nhóm nối đăng nhập thật.
    """
    return repository.profile(customer)


@router.put("/me", response_model=CustomerProfile, responses=ERRORS, summary="Lưu thông tin nhận hàng của khách hiện tại")
def save_current_profile(request: Recipient, customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    """Cập nhật tên, điện thoại và địa chỉ mặc định của khách đã xác minh.
    Không nhận mã khách, không sửa tài khoản đăng nhập, không tạo đơn/hóa đơn.
    """
    return repository.save_profile(request, customer)


@router.post("/checkout/quote", response_model=CheckoutQuote, responses=ERRORS, summary="Báo giá giỏ hàng và kiểm tra voucher")
def quote_checkout(request: QuoteRequest, customer: Customer, repository: Repository):
    """Giá/tổng do database tính; chọn một kho đủ hàng cho mỗi SKU.
    Chỉ báo giá, không giữ hàng hoặc ghi lượt voucher. Tạo đơn sẽ kiểm tra lại.
    Giá trước thuế, thuế 10% áp dụng khi lập hóa đơn; phí vận chuyển chưa báo giá.
    """
    return repository.quote(request, customer)


@router.post("/orders", response_model=CustomerOrderReceipt, status_code=201,
             responses={200: {"model": CustomerOrderReceipt, "description": "Replay của cùng khách/key/nội dung."}, **ERRORS},
             summary="Đặt đơn thuộc khách với voucher và idempotency")
def create_customer_order(request: CustomerOrderRequest, customer: Customer, repository: Repository, response: Response,
                          idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36)]):
    """Một RPC transaction chốt tên/đơn vị/giá/giảm giá, giữ hàng và lượt voucher.
    Không nhận ma_kh từ client; khách lấy từ xác thực. Retry giữ nguyên key và body.
    Không trừ tồn thực, không lập hóa đơn hoặc thu tiền. Giao dịch thanh toán đọc riêng.
    """
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError("UUID v4 required")
    except ValueError:
        raise PaymentError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.") from None
    receipt, replayed = repository.create(request, customer, key)
    response.status_code = 200 if replayed else 201
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    return receipt


@router.get("/orders", response_model=OrderPage, responses=ERRORS, summary="Danh sách đơn thuộc khách")
def list_orders(customer: Customer, repository: Repository, query: Annotated[OrderQuery, Query()]):
    return repository.orders(customer, query=query)


@router.get("/orders/{order_id}", response_model=OrderDetail, responses=ERRORS, summary="Chi tiết đơn thuộc khách")
def order_detail(order_id: OrderId, customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    """Đơn không tồn tại/thuộc khách khác/khách vãng lai cùng trả 404."""
    return repository.orders(customer, order_id=order_id)


@router.get("/orders/{order_id}/invoice", response_model=InvoiceOverview, responses=ERRORS, summary="Hóa đơn công khai của đơn thuộc khách")
def order_invoice(order_id: OrderId, customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    """Đọc tổng hóa đơn và giá/thành tiền các dòng đơn đã chốt.
    Không trả mã giao dịch, người lập, mã số thuế hoặc dữ liệu tài khoản.
    Đơn chưa có hóa đơn trả invoice=null; không tự lập hóa đơn.
    """
    return repository.invoice(order_id, customer)

from fastapi import APIRouter, Depends, Path, Response

from phub_api.dependencies.admin_order_detail import get_service
from phub_api.schemas.admin_order_detail import AdminOrderDetail
from phub_api.schemas.api_contracts import READ_ERRORS, error_response
from phub_api.services.admin_order_detail import AdminOrderDetailService

router = APIRouter(prefix="/api/admin/orders", tags=["Admin · Vận hành"])


@router.get("/{order_id}/detail", response_model=AdminOrderDetail,
            summary="Lấy toàn bộ chi tiết một đơn hàng trong một lần gọi",
            responses={**READ_ERRORS, 404: error_response(404, "Không tìm thấy đơn hàng."),
                       409: error_response(409, "Dữ liệu chưa đầy đủ hoặc vừa thay đổi; cần tải lại.")})
def detail(response: Response, order_id: str = Path(..., min_length=1, max_length=100),
           service: AdminOrderDetailService = Depends(get_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.read(order_id)

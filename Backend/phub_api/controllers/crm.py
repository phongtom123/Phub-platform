from typing import Annotated

from fastapi import APIRouter, Depends, Query

from phub_api.dependencies.crm import read_service, write_service
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response
from phub_api.schemas.crm import CustomerDetail, CustomerOrders, CustomerUpdate, Identifier
from phub_api.services.crm import CrmService

router = APIRouter(prefix="/api/crm", tags=["Admin · CRM"])
Read = Annotated[CrmService, Depends(read_service)]
Write = Annotated[CrmService, Depends(write_service)]


@router.get("/customers/{customer_id}", response_model=CustomerDetail,
            responses={**READ_ERRORS, 404: error_response(404, "Không tìm thấy khách hàng.")},
            summary="Hồ sơ khách hàng và tài khoản liên kết")
def customer_detail(customer_id: Identifier, service: Read):
    return service.detail(customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerDetail,
              responses={**WRITE_ERRORS, 404: error_response(404, "Không tìm thấy khách hàng.")},
              summary="Lưu hồ sơ khách; không sửa trạng thái tài khoản/lưu trữ")
def update_customer(customer_id: Identifier, body: CustomerUpdate, service: Write):
    return service.update(customer_id, body)


@router.get("/customers/{customer_id}/orders", response_model=CustomerOrders, responses=READ_ERRORS,
            summary="Lịch sử đơn hàng được lọc theo đúng khách hàng")
def customer_orders(customer_id: Identifier, service: Read,
                    page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100)):
    return service.orders(customer_id, page, page_size)

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from phub_api.dependencies.invoice_claims import customer_write, staff_read, staff_write
from phub_api.schemas.admin_operations import PosOrder
from phub_api.schemas.invoice_claims import ClaimCreate, ClaimDecision
from phub_api.schemas.support import CustomerTicket
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS
from phub_api.services.invoice_claims import InvoiceClaimsService

router = APIRouter(tags=['Staff · Liên kết hóa đơn'])
Read = Annotated[InvoiceClaimsService, Depends(staff_read)]
Write = Annotated[InvoiceClaimsService, Depends(staff_write)]
CustomerWrite = Annotated[InvoiceClaimsService, Depends(customer_write)]


def request_key(key: UUID = Header(alias='Idempotency-Key')):
    if key.version != 4:
        raise HTTPException(422, 'Idempotency-Key phải là UUID v4.')
    return key


@router.post('/api/customer/crm/invoice-claims', status_code=201, response_model=CustomerTicket, responses=WRITE_ERRORS,
             summary='Gửi ticket yêu cầu liên kết hóa đơn cũ; không tra cứu hóa đơn công khai')
def create(body: ClaimCreate, service: CustomerWrite, key: UUID = Depends(request_key)):
    return service.create(key, body)


@router.get('/api/staff/invoice-claims', responses=READ_ERRORS, summary='Nhân viên xem yêu cầu liên kết hóa đơn')
def claims(service: Read, page: int = Query(1, ge=1, le=100000)):
    return service.read(page=page)


@router.get('/api/staff/invoice-claims/{ticket_id}', responses=READ_ERRORS, summary='Đối chiếu khách yêu cầu và hóa đơn tại quầy')
def detail(ticket_id: UUID, service: Read):
    return service.read(ticket_id)


@router.post('/api/staff/invoice-claims/{ticket_id}/decision', responses=WRITE_ERRORS, summary='Xác minh và chấp nhận/từ chối; không chuyển đơn của khách khác')
def decide(ticket_id: UUID, body: ClaimDecision, service: Write, key: UUID = Depends(request_key)):
    return service.decide(ticket_id, key, body)


@router.get('/api/staff/counter/{kind}', responses=READ_ERRORS, summary='Chọn tài khoản khách active hoặc hàng trong kho khi bán tại quầy')
def counter_catalog(kind: Literal['customers', 'products'], service: Read, q: str = Query('', max_length=100),
                    email: str | None = Query(None, min_length=3, max_length=254)):
    return service.catalog(kind, q.strip(), email)


@router.post('/api/staff/counter/orders', status_code=201, responses=WRITE_ERRORS, summary='Tạo đơn tại quầy gắn đúng tài khoản khách; không tự xác nhận thanh toán')
def counter_order(body: PosOrder, service: Write, key: UUID = Depends(request_key)):
    return service.order(key, body)

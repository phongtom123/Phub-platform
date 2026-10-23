from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from phub_api.dependencies.support import admin_read, admin_write, customer_read, customer_write
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response
from phub_api.schemas.support import AdminTicket, AdminTicketPage, CustomerTicket, CustomerTicketPage, TicketCreate, TicketUpdate, TicketStatus, TicketPriority
from phub_api.services.support import SupportService

router = APIRouter(tags=['Admin · Hỗ trợ khách hàng'])
Read = Annotated[SupportService, Depends(admin_read)]
Write = Annotated[SupportService, Depends(admin_write)]
CustomerRead = Annotated[SupportService, Depends(customer_read)]
CustomerWrite = Annotated[SupportService, Depends(customer_write)]
NOT_FOUND = {404: error_response(404, 'Không tìm thấy ticket.')}


@router.get('/api/crm/feedback', response_model=AdminTicketPage, responses=READ_ERRORS, summary='Danh sách ticket hỗ trợ: tìm kiếm, lọc và phân trang')
def admin_tickets(service: Read, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  status: TicketStatus | None = None, priority: TicketPriority | None = None,
                  q: str = Query('', max_length=100)):
    return service.page(False, page, page_size, status, priority, q.strip())


@router.get('/api/crm/feedback/{ticket_id}', response_model=AdminTicket, responses={**READ_ERRORS, **NOT_FOUND}, summary='Xem nội dung ticket và kết quả xử lý')
def admin_ticket(ticket_id: UUID, service: Read):
    return service.detail(ticket_id)


@router.patch('/api/crm/feedback/{ticket_id}', response_model=AdminTicket, responses={**WRITE_ERRORS, **NOT_FOUND}, summary='Nhận xử lý, cập nhật trạng thái/ưu tiên và phản hồi gửi khách')
def update_ticket(ticket_id: UUID, body: TicketUpdate, service: Write):
    return service.update(ticket_id, body)


@router.post('/api/customer/crm/feedback', status_code=201, response_model=CustomerTicket, tags=['Customer · Hỗ trợ'], responses=WRITE_ERRORS, summary='Khách gửi ticket phản hồi; chủ sở hữu lấy từ phiên')
def create_ticket(body: TicketCreate, service: CustomerWrite):
    return service.create(body)


@router.get('/api/customer/crm/feedback', response_model=CustomerTicketPage, tags=['Customer · Hỗ trợ'], responses=READ_ERRORS, summary='Danh sách ticket của khách đang đăng nhập')
def customer_tickets(service: CustomerRead, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return service.page(True, page, page_size)


@router.get('/api/customer/crm/feedback/{ticket_id}', response_model=CustomerTicket, tags=['Customer · Hỗ trợ'], responses={**READ_ERRORS, **NOT_FOUND}, summary='Khách xem ticket và phản hồi của chính mình')
def customer_ticket(ticket_id: UUID, service: CustomerRead):
    return service.detail(ticket_id, True)

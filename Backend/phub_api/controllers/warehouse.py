from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Path, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from phub_api.dependencies.origin import check_origin
from phub_api.dependencies.warehouse import get_service
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response
from phub_api.schemas.warehouse import (
    ManualInvoiceCreate, ReceiptCreate, ReceiptUpdate, ReceiptVersion, ReceiptConfirmVersion, WarehouseHistoryPage, WarehouseReceiptPage, WarehouseReceiptRead,
)

router = APIRouter(prefix='/api/warehouse', tags=['Kho · Nghiệp vụ'])
Service = Annotated[object, Depends(get_service)]
ReceiptId = Annotated[int, Path(ge=-(2**31), le=2**31-1)]
OperationKey = Annotated[UUID, Header(alias='Idempotency-Key')]
ERRORS = {**WRITE_ERRORS, 404: error_response(404, 'Không có phiếu trong kho được phân công.')}


@router.get('/receipts', response_model=WarehouseReceiptPage, responses=READ_ERRORS, summary='Danh sách phiếu nhập trong kho được phân công')
def receipts(response: Response, service: Service, q: str = Query('', max_length=100),
             status: Literal['NHAP', 'DA_NHAP', 'HUY'] | None = None,
             page: int = Query(1, ge=1, le=10000), page_size: int = Query(20, ge=1, le=100)):
    response.headers['Cache-Control'] = 'no-store'
    return service.read('receipts', q=q.strip(), status=status, page=page, page_size=page_size)


@router.get('/receipts/{receipt_id}', response_model=WarehouseReceiptRead, responses=ERRORS, summary='Phiếu nhập, các dòng hàng và phiên bản hiện tại')
def receipt(receipt_id: ReceiptId, response: Response, service: Service):
    response.headers['Cache-Control'] = 'no-store'
    return service.read('receipt', id=receipt_id)


async def write(request, response, service, action, operation_key, receipt_id, body):
    check_origin(request)
    result = await run_in_threadpool(service.command, action, operation_key, receipt_id, body)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Idempotency-Replayed'] = str(result.get('replayed', False)).lower()
    return result


@router.post('/receipts', status_code=201, response_model=WarehouseReceiptRead, responses=ERRORS, summary='Tạo phiếu nhập nháp tại kho được phân công')
async def create_receipt(body: ReceiptCreate, request: Request, response: Response, service: Service, operation_key: OperationKey):
    return await write(request, response, service, 'create', operation_key, None, body)


@router.patch('/receipts/{receipt_id}', response_model=WarehouseReceiptRead, responses=ERRORS, summary='Sửa nhà cung cấp, ghi chú và các dòng của phiếu nháp')
async def update_receipt(receipt_id: ReceiptId, body: ReceiptUpdate, request: Request, response: Response, service: Service, operation_key: OperationKey):
    return await write(request, response, service, 'update', operation_key, receipt_id, body)


@router.post('/receipts/{receipt_id}/confirm', response_model=WarehouseReceiptRead, responses=ERRORS, summary='Xác nhận nhập, cộng tồn và ghi lịch sử trong một transaction')
async def confirm_receipt(receipt_id: ReceiptId, body: ReceiptConfirmVersion, request: Request, response: Response, service: Service, operation_key: OperationKey):
    return await write(request, response, service, 'confirm', operation_key, receipt_id, body)


@router.post('/receipts/{receipt_id}/cancel', response_model=WarehouseReceiptRead, responses=ERRORS, summary='Hủy phiếu nháp, giữ nguyên tồn kho')
async def cancel_receipt(receipt_id: ReceiptId, body: ReceiptVersion, request: Request, response: Response, service: Service, operation_key: OperationKey):
    return await write(request, response, service, 'cancel', operation_key, receipt_id, body)


@router.get('/manual-invoices/options', responses=READ_ERRORS, summary='Sản phẩm còn tồn khả dụng để lập hóa đơn thủ công')
def manual_invoice_options(response: Response, service: Service):
    response.headers['Cache-Control'] = 'no-store'
    return service.manual_invoice_options()


@router.get('/manual-invoices/customers', responses=READ_ERRORS, summary='Tìm khách hàng theo một phần email')
def manual_invoice_customers(response: Response, service: Service, q: str = Query('', max_length=100)):
    response.headers['Cache-Control'] = 'no-store'
    return service.search_invoice_customers(q)


@router.post('/manual-invoices', status_code=201, responses=ERRORS, summary='Lập hóa đơn trực tiếp từ tồn kho trong một transaction')
async def create_manual_invoice(body: ManualInvoiceCreate, request: Request, response: Response,
                                service: Service, operation_key: OperationKey):
    check_origin(request)
    result = await run_in_threadpool(service.create_manual_invoice, operation_key, body)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Idempotency-Replayed'] = str(result.get('replayed', False)).lower()
    return result


@router.get('/history', response_model=WarehouseHistoryPage, responses=READ_ERRORS, summary='Lịch sử biến động tồn trong kho được phân công')
def history(response: Response, service: Service, q: str = Query('', max_length=100),
            page: int = Query(1, ge=1, le=10000), page_size: int = Query(20, ge=1, le=100),
            start: date | None = None, end: date | None = None):
    response.headers['Cache-Control'] = 'no-store'
    return service.read('history', q=q.strip(), page=page, page_size=page_size, start=start, end=end)

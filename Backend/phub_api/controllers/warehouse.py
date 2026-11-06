from datetime import date
from uuid import uuid4
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request, Response
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError
from starlette.concurrency import run_in_threadpool

from phub_api.dependencies.origin import check_origin
from phub_api.dependencies.warehouse import get_service
from phub_api.dependencies.auth import current_user
from phub_api.config.database import get_supabase
from phub_api.models.user import User
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response
from phub_api.schemas.warehouse import (
    ReceiptCreate, ReceiptUpdate, ReceiptVersion, ReceiptConfirmVersion, WarehouseHistoryPage, WarehouseReceiptPage, WarehouseReceiptRead,
)

router = APIRouter(prefix='/api/warehouse', tags=['Kho · Nghiệp vụ'])
Service = Annotated[object, Depends(get_service)]
ReceiptId = Annotated[int, Path(ge=-(2**31), le=2**31-1)]
OperationKey = Annotated[UUID, Header(alias='Idempotency-Key')]
ERRORS = {**WRITE_ERRORS, 404: error_response(404, 'Không tìm thấy phiếu nhập.')}


class DispatchLine(BaseModel):
    sku: str = Field(min_length=1, max_length=200)
    warehouse_id: int | None = None
    quantity: int = Field(gt=0)


class DispatchDraft(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    warehouse_id: int | None = None
    note: str | None = Field(default=None, max_length=5000)
    lines: list[DispatchLine] = Field(min_length=1, max_length=500)


def _require_employee(user: User):
    if user.role not in {'ADMIN', 'NHAN_VIEN'} or not user.employee_id:
        raise HTTPException(403, 'Tài khoản không có quyền xử lý phiếu kho.')
    if user.role == 'NHAN_VIEN' and user.warehouse_id is None:
        raise HTTPException(403, 'Tài khoản nhân viên kho chưa được phân công kho.')


def _require_warehouse_scope(user: User, warehouse_id: int):
    _require_employee(user)
    if user.role == 'NHAN_VIEN' and user.warehouse_id != warehouse_id:
        raise HTTPException(403, 'Kho không thuộc phạm vi được phân quyền.')


def _dispatch_warehouse(user: User, requested: int | None, existing: int | None = None) -> int:
    if user.role == 'NHAN_VIEN':
        if user.warehouse_id is None:
            raise HTTPException(403, 'Tài khoản nhân viên kho chưa được phân công kho.')
        return user.warehouse_id
    warehouse_id = requested or existing
    if warehouse_id is None:
        raise HTTPException(422, 'ADMIN phải chỉ định kho xuất.')
    return warehouse_id


@router.get('/options', summary='Danh sách dữ liệu dùng khi lập phiếu kho')
def warehouse_options(user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    warehouses = db.table('KHO').select('ma_kho,ten_kho').eq('trang_thai', 1).order('ma_kho').limit(500).execute().data
    suppliers = db.table('NHA_CUNG_CAP').select('ma_ncc,ten_ncc').eq('trang_thai', 1).order('ma_ncc').limit(500).execute().data
    products = db.table('SAN_PHAM').select('ma_sp,sku,ten_sp,don_vi,gia_ban_hien_tai').eq('trang_thai', 1).order('sku').limit(1000).execute().data
    inventory_query = db.table('TON_KHO').select('ma_kho,sku,so_luong_ton')
    if user.role == 'NHAN_VIEN' and user.warehouse_id is not None:
        inventory_query = inventory_query.eq('ma_kho', user.warehouse_id)
    inventory = inventory_query.limit(5000).execute().data
    stock = {}
    for row in inventory:
        stock[row['sku']] = stock.get(row['sku'], 0) + int(row.get('so_luong_ton') or 0)
    products = [{**product, 'so_luong_ton': stock.get(product['sku'], 0)} for product in products]
    return {'warehouses': warehouses, 'suppliers': suppliers, 'products': products}


@router.get('/dispatches', summary='Danh sách phiếu xuất theo đơn hàng')
def dispatches(response: Response, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    response.headers['Cache-Control'] = 'no-store'
    try:
        documents = db.table('PHIEU_XUAT').select(
            'ma_phieu_xuat,ma_phieu_code,ma_donhang,ma_kho_xuat,trang_thai,ngay_tao,nguoi_tao'
        ).order('ngay_tao', desc=True).limit(500).execute().data
    except APIError:
        # Keep the legacy order view available until migration 009 is applied.
        documents = []
    if documents:
        return [{
            'id': row['ma_phieu_code'], 'recordId': row['ma_phieu_xuat'], 'order': row['ma_donhang'],
            'warehouse': f"Kho #{row['ma_kho_xuat']}", 'employeeCode': row.get('nguoi_tao') or '—',
            'items': '—', 'created': row.get('ngay_tao'),
            'status': {'NHAP': 'Nháp', 'DA_XAC_NHAN': 'Đã xác nhận', 'DA_XUAT': 'Đã xuất', 'HUY': 'Đã hủy'}.get(row.get('trang_thai'), row.get('trang_thai', '—')),
            'receiver': '—',
        } for row in documents]
    orders = db.table('DON_HANG').select(
        'ma_donhang,thoi_gian_dat,ten_nguoi_nhan,trang_thai,ma_nhan_vien'
    ).in_('trang_thai', ['MOI', 'XAC_NHAN', 'DANG_CHUAN_BI', 'DA_XUAT_KHO', 'HOAN_THANH']).order('thoi_gian_dat', desc=True).limit(500).execute().data
    status_map = {'MOI': 'Chờ xử lý', 'XAC_NHAN': 'Đã xác nhận', 'DANG_CHUAN_BI': 'Đang soạn', 'DA_XUAT_KHO': 'Đã xuất', 'HOAN_THANH': 'Hoàn tất'}
    return [{
        'id': f"PX-{order['ma_donhang']}", 'recordId': order['ma_donhang'], 'order': order['ma_donhang'],
        'warehouse': 'Tất cả kho', 'employeeCode': order.get('ma_nhan_vien') or '—',
        'items': '—', 'created': order.get('thoi_gian_dat'), 'status': status_map.get(order.get('trang_thai'), order.get('trang_thai', '—')),
        'receiver': order.get('ten_nguoi_nhan') or '—',
    } for order in orders]


@router.get('/dispatches/order-options')
def dispatch_order_options(sku: str = '', user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    if sku.strip():
        line_rows = db.table('CT_DON_HANG').select('ma_donhang,sku,don_gia,don_vi_luc_ban,so_luong,thanh_tien').eq('sku', sku.strip()).limit(500).execute().data
    else:
        eligible_orders = db.table('DON_HANG').select('ma_donhang').in_('trang_thai', ['MOI', 'XAC_NHAN', 'DANG_CHUAN_BI']).limit(500).execute().data
        order_ids = [row['ma_donhang'] for row in eligible_orders]
        return _dispatch_order_options_for_ids(order_ids, db)
    order_ids = [row['ma_donhang'] for row in line_rows]
    if not order_ids:
        return []
    orders = _dispatch_order_options_for_ids(order_ids, db)
    lines_by_order = {row['ma_donhang']: row for row in line_rows}
    for order in orders:
        line = lines_by_order.get(order['order_id'], {})
        order.update({
            'sku': line.get('sku'),
            'unit': line.get('don_vi_luc_ban') or '—',
            'unit_price': line.get('don_gia') or 0,
            'ordered_quantity': line.get('so_luong') or 0,
            'line_total': line.get('thanh_tien') or 0,
        })
    return orders


def _dispatch_order_options_for_ids(order_ids: list[str], db):
    if not order_ids:
        return []
    orders = db.table('DON_HANG').select('ma_donhang,ten_nguoi_nhan,trang_thai').in_('ma_donhang', order_ids).limit(500).execute().data
    return [{'order_id': row['ma_donhang'], 'receiver': row.get('ten_nguoi_nhan') or 'Khách hàng', 'status': row['trang_thai'], 'dispatchable': row['trang_thai'] in ['MOI', 'XAC_NHAN', 'DANG_CHUAN_BI']} for row in orders if row['trang_thai'] in ['MOI', 'XAC_NHAN', 'DANG_CHUAN_BI']]


@router.post('/dispatches/draft', status_code=201)
def create_dispatch_draft(body: DispatchDraft, user: User = Depends(current_user), db=Depends(get_supabase)):
    order = db.table('DON_HANG').select('ma_donhang,trang_thai').eq('ma_donhang', body.order_id).limit(1).execute().data
    if not order:
        raise HTTPException(404, 'Không tìm thấy đơn hàng.')
    if order[0]['trang_thai'] in {'DA_XUAT_KHO', 'HOAN_THANH', 'HUY'}:
        raise HTTPException(409, 'Đơn hàng không còn ở trạng thái có thể lập phiếu xuất.')
    warehouse_id = body.warehouse_id
    if warehouse_id is None and user.role == 'ADMIN':
        order_line = db.table('CT_DON_HANG').select('ma_kho_xuat').eq('ma_donhang', body.order_id).in_('sku', [line.sku for line in body.lines]).limit(1).execute().data
        warehouse_id = order_line[0].get('ma_kho_xuat') if order_line else None
    warehouse_id = _dispatch_warehouse(user, warehouse_id)
    _require_warehouse_scope(user, warehouse_id)
    try:
        result = db.rpc('create_dispatch_document', {
            'p_ma_donhang': body.order_id, 'p_ma_kho_xuat': warehouse_id,
            'p_nguoi_tao': user.employee_id, 'p_ghi_chu': body.note,
            'p_lines': [{**line.model_dump(), 'warehouse_id': warehouse_id} for line in body.lines],
        }).execute().data
        return {'data': result}
    except APIError as exc:
        # Older deployments may have the dispatch tables but not the RPC yet.
        # Keep draft creation usable while the SQL migration is being applied.
        if 'Could not find the function' in str(exc):
            code = f"PX-{body.order_id}-{uuid4().hex[:8].upper()}"
            try:
                document = db.table('PHIEU_XUAT').insert({
                    'ma_phieu_code': code,
                    'ma_donhang': body.order_id,
                    'ma_kho_xuat': warehouse_id,
                    'nguoi_tao': user.employee_id,
                    'ghi_chu': body.note,
                }).execute().data
                dispatch_id = document[0]['ma_phieu_xuat']
                db.table('CT_PHIEU_XUAT').insert([{
                    'ma_phieu_xuat': dispatch_id,
                    'sku': line.sku,
                    'ma_kho_xuat': warehouse_id,
                    'so_luong': line.quantity,
                } for line in body.lines]).execute()
                return {'data': {'ma_phieu_xuat': dispatch_id, 'ma_phieu_code': code, 'trang_thai': 'NHAP'}}
            except APIError as fallback_exc:
                if 'dispatch_id' in locals():
                    db.table('PHIEU_XUAT').delete().eq('ma_phieu_xuat', dispatch_id).execute()
                raise HTTPException(409, f'Không thể tạo phiếu xuất nháp: {getattr(fallback_exc, "message", None) or str(fallback_exc)}') from fallback_exc
        detail = getattr(exc, 'message', None) or str(exc)
        raise HTTPException(409, f'Không thể tạo phiếu xuất nháp: {detail}') from exc


@router.put('/dispatches/{dispatch_id}/draft')
def update_dispatch_draft(dispatch_id: int, body: DispatchDraft, user: User = Depends(current_user), db=Depends(get_supabase)):
    existing = db.table('PHIEU_XUAT').select('ma_phieu_xuat,trang_thai,ma_kho_xuat').eq('ma_phieu_xuat', dispatch_id).limit(1).execute().data
    if not existing:
        raise HTTPException(404, 'Không tìm thấy phiếu xuất.')
    if user.role == 'NHAN_VIEN' and existing[0]['ma_kho_xuat'] != user.warehouse_id:
        raise HTTPException(403, 'Phiếu xuất ngoài kho được phân quyền.')
    warehouse_id = _dispatch_warehouse(user, body.warehouse_id, existing[0]['ma_kho_xuat'])
    _require_warehouse_scope(user, warehouse_id)
    if existing[0]['trang_thai'] != 'NHAP':
        raise HTTPException(409, 'Phiếu xuất đã xác nhận, không thể chỉnh sửa.')
    try:
        result = db.rpc('update_dispatch_document', {
            'p_ma_phieu_xuat': dispatch_id, 'p_ma_donhang': body.order_id,
            'p_ma_kho_xuat': warehouse_id, 'p_ghi_chu': body.note,
            'p_lines': [{**line.model_dump(), 'warehouse_id': warehouse_id} for line in body.lines],
        }).execute().data
        return {'data': result}
    except APIError as exc:
        raise HTTPException(409, 'Không thể sửa phiếu xuất nháp.') from exc


@router.get('/dispatches/{dispatch_id}/draft')
def get_dispatch_draft(dispatch_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    docs = db.table('PHIEU_XUAT').select('ma_phieu_xuat,ma_donhang,ma_kho_xuat,ghi_chu,trang_thai').eq('ma_phieu_xuat', dispatch_id).limit(1).execute().data
    if not docs:
        raise HTTPException(404, 'Không tìm thấy phiếu xuất.')
    if user.role == 'NHAN_VIEN' and docs[0]['ma_kho_xuat'] != user.warehouse_id:
        raise HTTPException(403, 'Phiếu xuất ngoài kho được phân quyền.')
    lines = db.table('CT_PHIEU_XUAT').select('sku,ma_kho_xuat,so_luong').eq('ma_phieu_xuat', dispatch_id).limit(500).execute().data
    products = db.table('SAN_PHAM').select('ma_sp,sku,ten_sp,don_vi').in_('sku', [line['sku'] for line in lines]).limit(500).execute().data if lines else []
    order_lines = db.table('CT_DON_HANG').select('sku,don_gia,don_vi_luc_ban').eq('ma_donhang', docs[0]['ma_donhang']).limit(500).execute().data
    product_map = {product['sku']: product for product in products}
    order_line_map = {line['sku']: line for line in order_lines}
    lines = [{**line, 'ma_sp': product_map.get(line['sku'], {}).get('ma_sp'), 'ten_sp': product_map.get(line['sku'], {}).get('ten_sp'), 'don_vi': order_line_map.get(line['sku'], {}).get('don_vi_luc_ban') or product_map.get(line['sku'], {}).get('don_vi'), 'don_gia': order_line_map.get(line['sku'], {}).get('don_gia') or 0} for line in lines]
    return {'dispatch': docs[0], 'lines': lines}


@router.post('/dispatches/{dispatch_id}/confirm')
def confirm_dispatch(dispatch_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    try:
        return db.rpc('confirm_dispatch_document', {
            'p_ma_phieu_xuat': dispatch_id, 'p_nguoi_xac_nhan': user.employee_id,
            'p_ma_kho_duoc_phep': None if user.role == 'ADMIN' else user.warehouse_id,
        }).execute().data
    except APIError as exc:
        raise HTTPException(409, 'Không thể xác nhận phiếu xuất.') from exc


@router.post('/dispatches/{dispatch_id}/cancel')
def cancel_dispatch(dispatch_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    docs = db.table('PHIEU_XUAT').select('ma_phieu_xuat,ma_phieu_code,ma_kho_xuat,trang_thai').eq('ma_phieu_xuat', dispatch_id).limit(1).execute().data
    if not docs:
        raise HTTPException(404, 'Không tìm thấy phiếu xuất.')
    if user.role == 'NHAN_VIEN' and docs[0]['ma_kho_xuat'] != user.warehouse_id:
        raise HTTPException(403, 'Phiếu xuất ngoài kho được phân quyền.')
    if docs[0]['trang_thai'] != 'NHAP':
        raise HTTPException(409, 'Chỉ có thể xóa phiếu xuất nháp.')
    db.table('PHIEU_XUAT').update({'trang_thai': 'HUY'}).eq('ma_phieu_xuat', dispatch_id).execute()
    return {'ma_phieu_xuat': dispatch_id, 'ma_phieu_code': docs[0]['ma_phieu_code'], 'trang_thai': 'HUY'}


@router.post('/dispatches/{order_id}/dispatch')
def dispatch_order(order_id: str, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    try:
        return db.rpc('dispatch_order', {
            'p_ma_donhang': order_id, 'p_nguoi_xuat': user.employee_id,
            'p_ma_kho_duoc_phep': None if user.role == 'ADMIN' else user.warehouse_id,
        }).execute().data
    except APIError as exc:
        detail = getattr(exc, 'message', None) or str(exc)
        raise HTTPException(409, f'Không thể xuất kho theo đơn hàng: {detail}') from exc


@router.get('/receipts', response_model=WarehouseReceiptPage, responses=READ_ERRORS, summary='Danh sách phiếu nhập của tất cả kho')
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


@router.get('/history', response_model=WarehouseHistoryPage, responses=READ_ERRORS, summary='Lịch sử biến động tồn của tất cả kho')
def history(response: Response, service: Service, q: str = Query('', max_length=100),
            page: int = Query(1, ge=1, le=10000), page_size: int = Query(20, ge=1, le=100),
            start: date | None = None, end: date | None = None):
    response.headers['Cache-Control'] = 'no-store'
    return service.read('history', q=q.strip(), page=page, page_size=page_size, start=start, end=end)

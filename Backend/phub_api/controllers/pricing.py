from fastapi import APIRouter, Depends, Query, Request, Response, Path
from phub_api.dependencies.pricing import get_service
from phub_api.dependencies.origin import check_origin
from phub_api.schemas.pricing import PricePreview, PricingConfig, TaxDefinition, TaxEdit

router = APIRouter(prefix='/api/pricing', tags=['Admin · Định giá nhập hàng'])

@router.get('/config', summary='Cấu hình markup/thuế hiệu lực, danh mục và lịch sử sửa (ADMIN/KHO)')
def config(response: Response, sku: str | None = Query(None, min_length=1, max_length=100), service=Depends(get_service)):
    response.headers['Cache-Control'] = 'no-store'
    return service.context(sku)

@router.put('/config', summary='Sửa cấu hình sản phẩm hoặc mặc định hệ thống (ADMIN)')
def save_config(body: PricingConfig, request: Request, response: Response, sku: str | None = Query(None, min_length=1, max_length=100), service=Depends(get_service)):
    check_origin(request); response.headers['Cache-Control'] = 'no-store'
    return service.configure(sku, body)

@router.post('/preview', summary='Tính giá bằng Decimal tại backend; UI không gửi số tiền đã tính')
def preview(body: PricePreview, request: Request, response: Response, service=Depends(get_service)):
    check_origin(request); response.headers['Cache-Control'] = 'no-store'
    return service.preview(body)

@router.post('/taxes', status_code=201, summary='Tạo loại thuế (ADMIN)')
def add_tax(body: TaxDefinition, request: Request, response: Response, service=Depends(get_service)):
    check_origin(request); response.headers['Cache-Control'] = 'no-store'
    return service.tax(body.code, body, True)

@router.patch('/taxes/{code}', summary='Sửa tên/tỷ lệ mặc định loại thuế (ADMIN)')
def edit_tax(body: TaxEdit, request: Request, response: Response, code: str = Path(pattern=r'^[A-Z][A-Z0-9_]{0,29}$'), service=Depends(get_service)):
    check_origin(request); response.headers['Cache-Control'] = 'no-store'
    return service.tax(code, body, False)

@router.get('/receipts/{receipt_id}', summary='Preview giá trước xác nhận; version chống xác nhận giá cũ')
def receipt(receipt_id: int, response: Response, service=Depends(get_service)):
    response.headers['Cache-Control'] = 'no-store'
    return service.receipt(receipt_id)

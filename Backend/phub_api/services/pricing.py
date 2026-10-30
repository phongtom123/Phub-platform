from decimal import Decimal, DecimalException, localcontext, ROUND_HALF_UP
from fastapi import HTTPException
from postgrest.exceptions import APIError
from phub_api.config.warehouse import WAREHOUSE_SCOPE_MESSAGE, OPERATING_WAREHOUSE_ID

PRICING_ERRORS = {
    'PRICING_RECEIPT_ONLY': (410, 'Thuế và tỷ lệ lợi nhuận được nhập trực tiếp trên phiếu nhập. Không còn danh mục thuế hoặc cấu hình giá riêng.'),
    'SINGLE_WAREHOUSE': (422, WAREHOUSE_SCOPE_MESSAGE),
    'PRICING_FORBIDDEN': (403, 'Chỉ ADMIN được sửa tỷ lệ/thuế. Thủ kho chỉ xem và dùng cấu hình được duyệt.'),
    'PRICING_INVALID': (422, 'Giá nhập, tỷ lệ hoặc danh sách thuế không hợp lệ. Không ghi thay đổi.'),
    'PRICING_CHANGED': (409, 'Giá bán hoặc cấu hình đã thay đổi. Tải lại preview và xác nhận giá mới.'),
    'PRICING_FROZEN': (409, 'Phiếu đã nhập/hủy không được sửa snapshot giá.'),
    'PRICING_TAX_EXISTS': (409, 'Mã loại thuế đã tồn tại.'),
}

def calculate_price(cost: Decimal, markup: Decimal, taxes: list[dict]) -> dict:
    with localcontext() as context:
        context.prec = 50
        def whole(value):
            return value.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        profit = whole(cost * markup / 100)
        pre = whole(cost + profit)
        details = [{**tax, 'rate': str(tax['rate']), 'amount': str(whole(pre * Decimal(tax['rate']) / 100))} for tax in sorted(taxes, key=lambda tax: tax['code'])]
        total = sum((Decimal(tax['amount']) for tax in details), Decimal(0))
        if max(profit, pre, pre + total) >= Decimal('1e16'):
            raise HTTPException(422, 'Giá bán vượt giới hạn lưu trữ.')
        return {'unit_cost': str(cost), 'markup_rate': str(markup), 'profit': str(profit), 'pre_tax': str(pre), 'taxes': details,
                'total_tax': str(total), 'after_tax': str(pre + total),
                'actual_markup': str(((pre-cost)*100/cost).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP)) if cost else None,
                'margin': str(((pre-cost)*100/pre).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP)) if pre else None}

class PricingService:
    def __init__(self, repository, user):
        self.repository, self.user = repository, user

    def call(self, operation, *args, admin=False):
        if self.user.role == 'NHAN_VIEN' and self.user.warehouse_id != OPERATING_WAREHOUSE_ID:
            raise HTTPException(403, WAREHOUSE_SCOPE_MESSAGE)
        if self.user.role not in {'ADMIN', 'NHAN_VIEN'} or not self.user.employee_id or (admin and self.user.role != 'ADMIN'):
            raise HTTPException(403, PRICING_ERRORS['PRICING_FORBIDDEN'][1])
        try:
            return operation(self.user.account_id, *args)
        except APIError as error:
            if error.message in PRICING_ERRORS:
                status, detail = PRICING_ERRORS[error.message]
                raise HTTPException(status, detail) from None
            if error.code in {'PGRST202', '42P01', '42703', '42883'}:
                raise HTTPException(503, 'Cần áp dụng migration receipt_sale_pricing và cập nhật backend.') from None
            if error.message == 'NOT_FOUND':
                raise HTTPException(404, 'Không tìm thấy sản phẩm/phiếu trong phạm vi được phép.') from None
            if error.code in {'23514', '23503', '22003', '22P02', '23502'}:
                raise HTTPException(422, 'Thông tin giá hoặc thuế không hợp lệ.') from None
            raise

    def context(self, sku):
        return self.call(self.repository.context, sku)

    def preview(self, body):
        if self.user.role != 'ADMIN' and body.model_fields_set & {'markup_rate', 'taxes'}:
            raise HTTPException(403, PRICING_ERRORS['PRICING_FORBIDDEN'][1])
        context = self.context(body.sku)
        saved = None
        if body.receipt_id is not None:
            quote = self.receipt(body.receipt_id)
            if quote['status'] != 'NHAP':
                raise HTTPException(409, 'Phiếu đã xử lý, không tính lại lịch sử bằng cấu hình mới.')
            saved = next((line['price'] for line in quote['lines'] if line['sku'] == body.sku), None)
        rules = body.model_dump(mode='json')['taxes'] if body.taxes is not None else saved['taxes'] if saved else context['taxes']
        if len({tax['code'] for tax in rules}) != len(rules):
            raise HTTPException(422, 'Không được trùng mã thuế trong một dòng phiếu nhập.')
        rules = [{**tax, 'name': tax.get('name') or tax['code']} for tax in rules]
        try:
            price = calculate_price(body.unit_cost, body.markup_rate if body.markup_rate is not None else Decimal(saved['markup_rate'] if saved else context['markup_rate']), rules)
        except DecimalException:
            raise HTTPException(422, 'Tiền hoặc tỷ lệ không hợp lệ.') from None
        return {**price, 'sku': body.sku, 'current_price': context['current_price'], 'price_changed': Decimal(price['pre_tax']) != Decimal(context['current_price']), 'context': context}

    def configure(self, sku, body):
        return self.call(self.repository.configure, sku, body.model_dump(mode='json'), admin=True)

    def tax(self, code, body, create):
        return self.call(self.repository.tax, code, body.name, body.rate, create, admin=True)

    def receipt(self, receipt_id):
        return self.call(self.repository.receipt, receipt_id)

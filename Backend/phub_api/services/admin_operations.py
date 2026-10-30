from fastapi import HTTPException
from postgrest.exceptions import APIError
from pydantic import ValidationError
from uuid import UUID

from phub_api.schemas.admin_operations import COMMANDS

ERRORS = {
    'REPORT_TOO_LARGE': (422, 'Lịch sử vượt 20.000 dòng nhập/xuất. Cần tối ưu hoặc chốt kỳ trước khi tính, không trả báo cáo bị cắt thiếu.'),
    'TRANSFER_DISABLED': (410, 'Hệ thống chỉ sử dụng một kho; chức năng chuyển kho đã ngừng sử dụng.'),
    'ADMIN_FORBIDDEN': (403, 'Chỉ quản trị viên đang hoạt động được thực hiện.'),
    'NOT_FOUND': (404, 'Không tìm thấy bản ghi.'),
    'STATE_CONFLICT': (409, 'Trạng thái đã thay đổi hoặc không cho phép thao tác. Hãy làm mới.'),
    'IDEMPOTENCY_CONFLICT': (409, 'Mã yêu cầu đã dùng cho nội dung khác.'),
    'INSUFFICIENT_STOCK': (409, 'Không đủ tồn khả dụng; có hàng đang được giữ cho đơn khác.'),
    'STOCK_CHANGED': (409, 'Tồn kho đã thay đổi kể từ lúc kiểm kê. Hãy làm mới.'),
    'PRICE_CHANGED': (409, 'Giá sản phẩm đã thay đổi. Hãy làm mới giá trước khi tạo đơn.'),
    'PAYMENT_LIMIT': (409, 'Số tiền vượt số còn phải thu hoặc số được hoàn.'),
    'PAYMENT_REQUIRED': (409, 'Cần lập hóa đơn và thu đủ tiền trước khi hoàn thành đơn.'),
    'VOUCHER_UNAVAILABLE': (409, 'Voucher hết hạn, hết lượt hoặc không đủ điều kiện.'),
    'VALIDATION_ERROR': (422, 'Thông tin nghiệp vụ không hợp lệ.'),
}


class AdminOperationsService:
    def __init__(self, repository, user):
        self.repository, self.user = repository, user

    def call(self, operation, *args):
        if self.user.role != 'ADMIN' or not self.user.employee_id:
            raise HTTPException(403, ERRORS['ADMIN_FORBIDDEN'][1])
        try:
            return operation(*args)
        except APIError as exc:
            message = str(exc.message)
            for code, (status, detail) in ERRORS.items():
                if message == code:
                    raise HTTPException(status, detail) from None
            if exc.code in {'42883', 'PGRST202', '42P01'}:
                raise HTTPException(503, 'Database chưa cài migration admin_operations. Không có thao tác nào được ghi.') from None
            if exc.code == '23505':
                raise HTTPException(409, 'Mã phiếu hoặc mã đối soát đã tồn tại.') from None
            if exc.code in {'23503', '23514', '22003', '22P02'}:
                raise HTTPException(422, 'Dữ liệu tham chiếu, số lượng hoặc số tiền không hợp lệ.') from None
            raise

    def command(self, resource, command, key):
        schema = COMMANDS.get((resource, command.action))
        if not schema:
            raise HTTPException(422, 'Thao tác không được hỗ trợ.')
        try:
            data = schema.model_validate(command.data).model_dump(mode='json', exclude_none=True)
        except ValidationError as exc:
            raise HTTPException(422, [{'loc': ['data', *e['loc']], 'msg': e['msg']} for e in exc.errors()]) from None
        if resource == 'receipts':
            if command.action == 'create':
                if resource == 'receipts' and (data.get('supplier_id') is None or any('unit_price' not in l for l in data['lines'])):
                    raise HTTPException(422, 'Chọn nhà cung cấp và giá nhập cho từng sản phẩm.')
            if resource == 'receipts' and command.action == 'lines' and any('unit_price' not in l for l in data['lines']):
                raise HTTPException(422, 'Mỗi dòng phải có giá nhập.')
        if command.action != 'create' and resource in {'orders', 'receipts', 'support'} and not command.record_id:
            raise HTTPException(422, 'Thiếu mã bản ghi.')
        if resource == 'receipts' and command.record_id:
            try:
                value = int(command.record_id)
                if str(value) != command.record_id or not -(2**31) <= value < 2**31:
                    raise ValueError
            except ValueError:
                raise HTTPException(422, 'Mã phiếu phải là số nguyên PostgreSQL.') from None
        data['_expected_status'] = command.expected_status
        return self.call(self.repository.command, self.user.account_id, resource, command.action, key, command.record_id, data)

    def read(self, kind, query):
        if kind == 'messages':
            try:
                UUID(query.get('record_id') or '')
            except ValueError:
                raise HTTPException(422, 'Mã ticket không hợp lệ.') from None
        return self.call(self.repository.read, self.user.account_id, kind, query)

    def business_report(self, start, end):
        if start > end or (end - start).days >= 366 or end.isoformat() == '9999-12-31':
            raise HTTPException(422, 'Chọn kỳ báo cáo hợp lệ, tối đa 366 ngày.')
        try:
            return self.call(self.repository.business_report, self.user.account_id, start.isoformat(), end.isoformat())
        except HTTPException as error:
            if error.status_code == 503:
                raise HTTPException(503, 'Database chưa có hàm business_report. Cần áp dụng migration business_report.') from None
            raise

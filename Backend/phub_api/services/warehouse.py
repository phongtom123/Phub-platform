from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException
from postgrest.exceptions import APIError

ERRORS = {
    'WAREHOUSE_FORBIDDEN': (403, 'Nhân viên hoặc kho được phân công không còn hoạt động.'),
    'NOT_FOUND': (404, 'Không tìm thấy phiếu trong kho được phân công.'),
    'STATE_CONFLICT': (409, 'Phiếu không còn ở trạng thái nháp. Hãy tải lại.'),
    'DOCUMENT_CHANGED': (409, 'Phiếu đã được người khác sửa. Hãy tải lại trước khi tiếp tục.'),
    'IDEMPOTENCY_CONFLICT': (409, 'Mã yêu cầu đã được dùng cho nội dung khác.'),
    'VALIDATION_ERROR': (422, 'Nhà cung cấp, sản phẩm, số lượng hoặc giá nhập không hợp lệ.'),
}


class WarehouseService:
    def __init__(self, repository, user):
        self.repository, self.user = repository, user

    def call(self, operation, *args):
        if self.user.role != 'NHAN_VIEN' or not self.user.employee_id or self.user.warehouse_id is None:
            raise HTTPException(403, 'Chỉ nhân viên đã được phân công kho mới được thực hiện.')
        try:
            return operation(*args)
        except APIError as exc:
            if str(exc.message) in ERRORS:
                status, detail = ERRORS[str(exc.message)]
                raise HTTPException(status, detail) from None
            if str(exc.code) in {'PGRST202', '42883', '42P01'}:
                raise HTTPException(503, 'Database chưa cài migration warehouse_receipts.') from None
            if str(exc.code) == '23505':
                raise HTTPException(409, 'Mã phiếu đã tồn tại. Hãy làm mới.') from None
            if str(exc.code) in {'23503', '23514', '23502', '22003', '22P02', '22007'}:
                raise HTTPException(422, 'Dữ liệu phiếu hoặc tham chiếu không hợp lệ.') from None
            raise

    def command(self, action, key, receipt_id, body):
        if key.version != 4:
            raise HTTPException(422, 'Idempotency-Key phải là UUID v4.')
        return self.call(self.repository.command, self.user.account_id, action, key, receipt_id,
                         body.model_dump(mode='json'))

    def read(self, kind, **query):
        start, end = query.pop('start', None), query.pop('end', None)
        if start and end and start > end:
            raise HTTPException(422, 'Ngày bắt đầu phải trước ngày kết thúc.')
        zone = timezone(timedelta(hours=7))
        try:
            if start:
                query['start'] = datetime.combine(start, time.min, zone).astimezone(timezone.utc).isoformat()
            if end:
                query['end'] = datetime.combine(end + timedelta(days=1), time.min, zone).astimezone(timezone.utc).isoformat()
        except OverflowError:
            raise HTTPException(422, 'Khoảng ngày nằm ngoài giới hạn hỗ trợ.') from None
        return self.call(self.repository.read, self.user.account_id, kind, {k: v for k, v in query.items() if v is not None})

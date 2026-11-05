from fastapi import HTTPException
from postgrest.exceptions import APIError

from phub_api.models.user import User
from phub_api.repositories.support import SupportRepository


class SupportService:
    def __init__(self, repository: SupportRepository, actor: User):
        self.repository, self.actor = repository, actor

    def scope(self, customer):
        if customer:
            if self.actor.role != 'KHACH_HANG' or not self.actor.customer_id:
                raise HTTPException(403, 'Chỉ khách hàng được dùng chức năng này.')
            return self.actor.customer_id
        if self.actor.role != 'ADMIN':
            raise HTTPException(403, 'Chỉ ADMIN được tiếp nhận ticket.')
        return None

    def call(self, operation, *args):
        try:
            return operation(*args)
        except APIError as exc:
            if exc.message in {'NOT_FOUND', 'ADMIN_FORBIDDEN', 'STATE_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'VALIDATION_ERROR'}:
                status = {'NOT_FOUND': 404, 'ADMIN_FORBIDDEN': 403, 'STATE_CONFLICT': 409, 'IDEMPOTENCY_CONFLICT': 409, 'VALIDATION_ERROR': 422}[exc.message]
                raise HTTPException(status, 'Không thể gửi tin nhắn: ticket không thuộc tài khoản, đã đóng hoặc yêu cầu không hợp lệ.') from None
            if str(exc.code) in {'PGRST202', 'PGRST205', '42P01', '42883', '42703'}:
                raise HTTPException(503, 'Chưa có cấu trúc hỗ trợ khách hàng. Cần chạy migration 20261023_customer_support.sql và cập nhật backend.') from None
            if str(exc.code) == '42501':
                raise HTTPException(403, 'Tài khoản không còn quyền xử lý yêu cầu.') from None
            if str(exc.code) == 'P0002':
                raise HTTPException(404, 'Không tìm thấy ticket.') from None
            raise

    @staticmethod
    def admin_row(row):
        return {**row, 'ten_kh': row.get('ten_kh') or (row.get('khach') or {}).get('ten_kh'),
                'ten_nguoi_xu_ly': row.get('ten_nguoi_xu_ly') or (row.get('nhan_vien') or {}).get('ho_ten')}

    def page(self, customer, page, page_size, status=None, priority=None, query=''):
        scope = self.scope(customer)
        result = self.call(self.repository.page, scope, page, page_size, status, priority, query)
        return {'data': result.data if customer else [self.admin_row(row) for row in result.data],
                'total': result.count or 0, 'page': page, 'page_size': page_size}

    def detail(self, ticket_id, customer=False):
        rows = self.call(self.repository.detail, ticket_id, self.scope(customer))
        if not rows:
            raise HTTPException(404, 'Không tìm thấy ticket hoặc ticket không thuộc tài khoản của bạn.')
        return rows[0] if customer else self.admin_row(rows[0])

    def create(self, body):
        self.scope(True)
        return self.call(self.repository.create, self.actor.account_id, body.model_dump(mode='json'))

    def update(self, ticket_id, body):
        self.scope(False)
        return self.call(self.repository.update, self.actor.account_id, ticket_id, body.model_dump(mode='json', exclude_unset=True))

    def history(self, ticket_id, page, text=None, key=None):
        self.scope(True)
        return self.call(self.repository.history, self.actor.account_id, ticket_id, page, text, key)

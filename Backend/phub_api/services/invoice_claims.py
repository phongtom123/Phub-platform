from fastapi import HTTPException
from postgrest.exceptions import APIError
import re

from phub_api.services.admin_operations import ERRORS


class InvoiceClaimsService:
    def __init__(self, repository, actor):
        self.repository, self.actor = repository, actor

    def call(self, operation, *args, customer=False):
        allowed = self.actor.role == 'KHACH_HANG' and self.actor.customer_id if customer else self.actor.role == 'NHAN_VIEN' and self.actor.employee_id
        if not allowed:
            raise HTTPException(403, 'Tài khoản không được thực hiện chức năng này.')
        try:
            return operation(self.actor.account_id, *args)
        except APIError as exc:
            code = str(exc.code)
            if code in {'PGRST202', 'PGRST205', '42P01', '42703', '42883'}:
                raise HTTPException(503, 'Chức năng bán tại quầy/liên kết hóa đơn chưa sẵn sàng. Cần cập nhật backend/database; tra cứu email cần migration counter_buyer_email.') from None
            if code == '23505':
                raise HTTPException(409, 'Bạn đã gửi yêu cầu cho hóa đơn này. Hãy xem lịch sử hỗ trợ.') from None
            if code in {'42501', '40001', 'P0002', '23514'}:
                raise HTTPException({'42501': 403, '40001': 409, 'P0002': 404, '23514': 422}[code], exc.message) from None
            if exc.message in ERRORS:
                status, detail = ERRORS[exc.message]
                raise HTTPException(status, detail) from None
            if code in {'23503', '22P02', '22003'}:
                raise HTTPException(422, 'Thông tin tham chiếu không hợp lệ.') from None
            raise

    def create(self, key, body):
        return self.call(self.repository.create, key, body.invoice_id, body.evidence, customer=True)

    def read(self, ticket_id=None, page=1):
        return self.call(self.repository.read, ticket_id, page)

    def decide(self, ticket_id, key, body):
        return self.call(self.repository.decide, ticket_id, key, body)

    def catalog(self, kind, query, email=None):
        if email is not None:
            email = email.strip().lower()
            if kind != 'customers' or len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                raise HTTPException(422, 'Email khách hàng không đúng định dạng.')
            return self.call(self.repository.customer_email, email)
        return self.call(self.repository.catalog, kind, query)

    def order(self, key, body):
        return self.call(self.repository.order, key, body)

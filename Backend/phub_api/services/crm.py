from fastapi import HTTPException
from postgrest.exceptions import APIError

from phub_api.models.user import User
from phub_api.repositories.crm import CrmRepository
from phub_api.schemas.crm import CustomerUpdate


class CrmService:
    def __init__(self, repository: CrmRepository, actor: User):
        self.repository, self.actor = repository, actor

    def require_admin(self):
        if self.actor.role != "ADMIN":
            raise HTTPException(403, "Chỉ quản trị viên được quản lý hồ sơ CRM.")

    def detail(self, customer_id):
        self.require_admin()
        rows = self.repository.profile(customer_id)
        if not rows:
            raise HTTPException(404, "Không tìm thấy khách hàng.")
        accounts = self.repository.account(customer_id)
        return {"profile": rows[0], "account": accounts[0] if accounts else None}

    def update(self, customer_id, body: CustomerUpdate):
        self.require_admin()
        fields = body.model_dump(mode="json", exclude_unset=True)
        try:
            result = self.repository.update(customer_id, self.actor.account_id, fields)
        except APIError as exc:
            if str(exc.code) in {"PGRST202", "42883"}:
                raise HTTPException(503, "Chưa có hàm lưu hồ sơ. Cần áp dụng migration 20261023012955_remove_customer_interests.sql.") from None
            if str(exc.code) == "P0002":
                raise HTTPException(404, "Không tìm thấy khách hàng.") from None
            if str(exc.code) == "42501":
                raise HTTPException(403, "Phiên quản trị không còn quyền cập nhật CRM.") from None
            raise
        # The RPC returns the committed snapshot, avoiding a second read that could
        # fail after a successful write and incorrectly report the save as failed.
        return result

    def orders(self, customer_id, page, page_size):
        self.require_admin()
        if not self.repository.profile(customer_id):
            raise HTTPException(404, "Không tìm thấy khách hàng.")
        result = self.repository.orders(customer_id, page, page_size)
        return {"data": result.data, "total": result.count or 0, "page": page, "page_size": page_size}

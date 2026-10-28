from fastapi import HTTPException

from phub_api.models.user import User
from phub_api.repositories.tables import TablesRepository, clean
from phub_api.schemas.warehouse_drafts import ReceiptDraftUpdate
from phub_api.services.tables import key_values


class WarehouseDraftService:
    def __init__(self, repository: TablesRepository, user: User):
        self.repository, self.user = repository, user

    def update(self, resource: str, key: str, body: ReceiptDraftUpdate):
        if resource != "receipts":
            raise HTTPException(410, "Chức năng chuyển kho đã ngừng sử dụng; hệ thống chỉ sử dụng một kho.")
        if self.user.role != "ADMIN" or not self.user.employee_id:
            raise HTTPException(403, "Chỉ quản trị viên có hồ sơ nhân viên được sửa phiếu nháp.")
        keys = key_values(resource, key)
        values = body.model_dump(exclude_unset=True)
        if not values:
            raise HTTPException(422, "Không có trường cần cập nhật.")
        for field, value in values.items():
            if field != "ghi_chu" and (value is None or isinstance(value, str) and not value.strip()):
                raise HTTPException(422, f"{field} không được để trống.")
            if isinstance(value, str):
                values[field] = value.strip() or None
        existing = self.repository.detail(resource, self.user, keys)
        if not existing:
            raise HTTPException(404, "Không tìm thấy phiếu.")
        if existing[0]["trang_thai"] != "NHAP":
            raise HTTPException(409, "Chỉ sửa được phiếu nháp. Phiếu đã xử lý được giữ nguyên thông tin.")
        if resource == "receipts":
            values["nguoi_cap_nhat"] = self.user.employee_id
        rows = self.repository.update_draft(resource, keys, values)
        if not rows:
            raise HTTPException(409, "Phiếu vừa được xử lý hoặc không còn tồn tại. Hãy làm mới trước khi sửa.")
        return {"data": clean(rows)}

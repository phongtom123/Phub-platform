"""Reusable documentation/response contracts; never contain database credentials."""
from typing import Any, Literal

from pydantic import BaseModel


class ValidationIssue(BaseModel):
    loc: list[str | int]
    msg: str
    type: str | None = None


class ApiErrorResponse(BaseModel):
    detail: str | list[ValidationIssue]


class SessionUser(BaseModel):
    account_id: str
    username: str
    role: Literal["ADMIN", "THU_KHO", "KHACH_HANG"]
    name: str
    customer_id: str | None = None
    employee_id: str | None = None
    warehouse_id: int | None = None


class ResourceColumn(BaseModel):
    name: str
    type: str
    required: bool
    generated: bool
    default: str | int | None
    choices: list[str] | None
    immutable: bool
    system: bool


class ResourceMetadata(BaseModel):
    name: str
    table: str
    title: str
    keys: list[str]
    columns: list[ResourceColumn]
    writable: bool
    create_schema: dict[str, Any] | None


def error_response(status: int, message: str, *, validation: bool = False) -> dict:
    example = {"detail": [{"loc": ["body", "ten_sp"], "msg": "Field required", "type": "missing"}]} if validation else {"detail": message}
    return {"model": ApiErrorResponse, "description": message,
            "content": {"application/json": {"example": example}}}


READ_ERRORS = {
    401: error_response(401, "Chưa đăng nhập, phiên hết hạn hoặc tài khoản không hoạt động."),
    403: error_response(403, "Role không có quyền xem dữ liệu này."),
    422: error_response(422, "Tham số hoặc kiểu dữ liệu không hợp lệ.", validation=True),
    503: error_response(503, "Backend chưa cấu hình hoặc dịch vụ database không khả dụng."),
}
WRITE_ERRORS = {
    **READ_ERRORS,
    403: error_response(403, "Role không được ghi dữ liệu hoặc Origin không nằm trong allowlist."),
    409: error_response(409, "Mã hoặc dữ liệu duy nhất đã tồn tại."),
    422: error_response(422, "Body/tham số không hợp lệ hoặc vi phạm khóa ngoại/check constraint.", validation=True),
}

ORIGIN_DOCUMENTATION = {
    "name": "Origin", "in": "header", "required": True,
    "description": "CSRF: phải khớp FRONTEND_ORIGINS. Trình duyệt tự gửi header này; Swagger không thể sửa thủ công. Khi dùng Postman/CLI, gửi Origin đã cấu hình.",
    "schema": {"type": "string", "format": "uri"}, "example": "http://localhost:8000",
}

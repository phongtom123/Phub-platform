"""OpenAPI presentation for the actual generic table routes.

Each concrete URL below is served by /api/data/{resource}; documentation changes
neither request dispatch nor authorization. Writable operations are only published
for master data. Request schemas come from the same models as runtime validation.
"""
from copy import deepcopy
import json

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from .api_contracts import ORIGIN_DOCUMENTATION
from .api_examples import SESSION_EXAMPLE, key_example, payload_example, row_example
from .config import COOKIE_NAME
from .resources import ENUMS, RESOURCES, SYSTEM_FIELDS, payload_model, public_columns
from .tables import CUSTOMER_READ

DESCRIPTION = """
## Nơi quản lý đặc tả PHUB API

UI Next.js gọi gateway `/api/backend/*`, gateway chuyển đến API Python trên trang này.
Catalog có prefix `/api/catalog`, các bảng nội bộ có prefix `/api/data`, tài khoản admin ở `/api/admin`.
Tất cả ví dụ là dữ liệu giả minh họa, **không phải tài khoản có sẵn hoặc seed**.

### Đăng nhập và thử API

1. Cấu hình `Backend/.env` và database theo `Backend/README.md`.
2. Mở **http://localhost:8000/docs**, đăng nhập bằng `POST /api/auth/login` → Try it out → Execute.
3. Trình duyệt lưu cookie HttpOnly `phub_session`; thử `GET /api/auth/me`, sau đó các API theo role.
4. Dùng cùng hostname cho docs và UI; không trộn localhost với 127.0.0.1.

**Không nhập Supabase key hoặc dán token vào nút Authorize.** Swagger không thể tự đặt cookie HttpOnly
qua Authorize. Cookie có sẵn trên cùng host được trình duyệt gửi tự động; nếu công cụ không gửi cookie,
dùng Postman/cookie jar hoặc đăng nhập qua UI trên cùng host trước.
POST/PATCH/PUT kiểm tra CSRF qua Origin. Origin của trang docs phải có trong `FRONTEND_ORIGINS`.
Mẫu cấu hình local đã có localhost:8000 và 127.0.0.1:8000; khi triển khai phải cấu hình origin thực tế.

### Quy ước dữ liệu

- Tiền ở response là **chuỗi decimal**, ví dụ `2500000.00`; không tính tiền bằng float JavaScript.
- Chi tiết bảng vẫn trả `{data: [...], total, page, page_size}`; không tìm thấy GET trả data rỗng.
- `key` là **chuỗi JSON của mảng khóa chính**, theo đúng thứ tự và kiểu ghi ở từng endpoint.
- PATCH chỉ gửi trường thay đổi. Không được sửa PK/SKU/người tạo; null chỉ dùng cho trường nullable.
- ADMIN xem tất cả bảng; THU_KHO giới hạn theo kho; KHACH_HANG chỉ xem dữ liệu của mình.
- Lỗi auth/table có `{detail: ...}`; catalog giữ contract `{error: {code, message, details}}`.

### Phạm vi hiện tại

Đã viết API đọc 19 bảng và tạo/sửa 8 bảng dữ liệu nền; tài khoản có 11 thao tác riêng ở `/api/admin`.
**Chưa xác nhận kết nối live Supabase.** Không có DELETE.
Các bảng chứng từ/tồn kho/tài chính chỉ có GET: chưa triển khai ghi đơn, checkout,
nhập/xuất/nhận kho, chốt hóa đơn, webhook/hoàn tiền và áp voucher bằng transaction.
Tài khoản admin đã có tạo/sửa/khóa/ẩn/đổi quyền/cấp lại mật khẩu và đổi mật khẩu của mình.
Đăng ký tự phục vụ, quên mật khẩu qua email và refresh token chưa có.
Các module mua hàng có đặc tả riêng; không coi CRUD bảng là checkout/ghi chứng từ có transaction.
"""

TAGS = [
    {"name": "Admin · Tài khoản", "description": "Quản lý tài khoản và thông tin đăng nhập admin; không xóa dữ liệu."},
    {"name": "Shared · Xác thực", "description": "Login/me/logout. Cookie HttpOnly, role lấy từ database."},
    {"name": "Shared · Hệ thống", "description": "Health chỉ kiểm tra API đang chạy; không kiểm tra database."},
    {"name": "Shared · Metadata", "description": "Danh mục bảng/trường/model tạo theo quyền của phiên hiện tại."},
    {"name": "Admin · Tổ chức", "description": "Kho, nhân viên, tài khoản. Mật khẩu chỉ có trong request, không có trong response."},
    {"name": "Admin · Khách hàng", "description": "ADMIN tạo/sửa; khách hàng chỉ đọc hồ sơ của mình."},
    {"name": "Admin · Sản phẩm", "description": "Loại sản phẩm và sản phẩm PC/linh kiện. SKU không đổi sau khi tạo."},
    {"name": "Admin · Khuyến mãi", "description": "Chương trình, voucher và lịch sử sử dụng. Áp voucher cho đơn chưa có API ghi."},
    {"name": "Kho · Tồn kho", "description": "Chỉ đọc tồn thực; không mở CRUD số lượng tồn."},
    {"name": "Kho · Nhà cung cấp", "description": "ADMIN và THU_KHO tạo/sửa nhà cung cấp."},
    {"name": "Kho · Phiếu nhập", "description": "Phiếu và dòng hàng chỉ đọc. Xác nhận nhập cần transaction riêng."},
    {"name": "Kho · Chuyển kho", "description": "Phiếu và dòng hàng chỉ đọc; thấy phiếu liên quan kho xuất hoặc kho nhận được gán."},
    {"name": "Bán hàng · Đơn hàng", "description": "Đơn và dòng hàng chỉ đọc; khách chỉ đọc đơn của mình."},
    {"name": "Bán hàng · Tài chính", "description": "Hóa đơn, thanh toán chỉ đọc. Không ghi tiền qua CRUD tổng quát."},
    {"name": "Customer · Catalog", "description": "API công khai, không cần đăng nhập. Chỉ trả sản phẩm/loại đang hoạt động."},
]
RESOURCE_TAGS = {
    "warehouses": "Admin · Tổ chức", "employees": "Admin · Tổ chức", "accounts": "Admin · Tổ chức",
    "customers": "Admin · Khách hàng", "categories": "Admin · Sản phẩm", "products": "Admin · Sản phẩm",
    "promotions": "Admin · Khuyến mãi", "vouchers": "Admin · Khuyến mãi", "voucher-uses": "Admin · Khuyến mãi",
    "inventory": "Kho · Tồn kho", "suppliers": "Kho · Nhà cung cấp",
    "receipts": "Kho · Phiếu nhập", "receipt-lines": "Kho · Phiếu nhập",
    "transfers": "Kho · Chuyển kho", "transfer-lines": "Kho · Chuyển kho",
    "orders": "Bán hàng · Đơn hàng", "order-lines": "Bán hàng · Đơn hàng",
    "invoices": "Bán hàng · Tài chính", "payments": "Bán hàng · Tài chính",
}
NOTES = {
    "accounts": "GET bảng này chỉ đọc. Quản lý tài khoản qua /api/admin/accounts và /api/admin/me; không dùng POST/PATCH generic. Không gửi mat_khau_hash.",
    "employees": "Role ADMIN yêu cầu ma_kho=null; THU_KHO yêu cầu ma_kho của một kho tồn tại.",
    "products": "Ảnh sửa bằng URL duong_dan_anh; upload file chưa có API. Giá/bảo hành không âm; ma_loai_sp phải tồn tại. Không sửa SKU.",
    "promotions": "Ngày kết thúc sau ngày bắt đầu. nguoi_tao và ngay_tao do server gán, không gửi trong body. Schema hiện tại chưa có cột ảnh chương trình.",
    "vouchers": "ma_code được trim/uppercase. PHAN_TRAM có giá trị (0,100]; giam_toi_da chỉ dùng cho phần trăm. Giới hạn lượt phải dương. ngay_tao do server gán.",
}


def roles_for(name: str, write: bool = False) -> list[str]:
    if write:
        return ["ADMIN", "THU_KHO"] if name == "suppliers" else ["ADMIN"]
    roles = ["ADMIN"]
    if RESOURCES[name].warehouse:
        roles.append("THU_KHO")
    if name in CUSTOMER_READ:
        roles.append("KHACH_HANG")
    return roles


def row_schema(name: str) -> dict:
    properties = {}
    for column in public_columns(name):
        field, kind = column["name"], column["type"]
        prop = {"type": "integer"} if kind == "int" else {"type": "string"}
        description = field
        if kind == "datetime":
            prop["format"] = "date-time"
        if kind.startswith("decimal"):
            prop["pattern"] = r"^-?\d+(\.\d{1,2})?$"
            description += " · chuỗi decimal, không phải JSON number"
        if column["generated"]:
            description += " · database tự sinh"
        if field in SYSTEM_FIELDS.get(name, set()):
            description += " · server tự gán"
        if not column["required"]:
            prop = {"anyOf": [prop, {"type": "null"}]}
        prop["description"] = description
        properties[field] = prop
    return {"type": "object", "title": f"{RESOURCES[name].table}Read", "properties": properties,
            "required": list(properties), "additionalProperties": False, "example": row_example(name)}


def request_schema(name: str, patch: bool) -> dict:
    result = payload_model(name, patch).model_json_schema(ref_template="#/components/schemas/{model}")
    for field, prop in result["properties"].items():
        prop.setdefault("description", field)
        choices = ENUMS.get((name, field))
        if choices:
            prop["enum"] = choices
        column = next((c for c in public_columns(name) if c["name"] == field), None)
        if field == "trang_thai" and column and column["type"] == "int":
            prop["enum"] = [0, 1, 2]
        if column and column["type"].startswith("decimal"):
            prop["description"] += " · nhận chuỗi decimal hoặc JSON number; response trả chuỗi"
        if patch:
            prop.pop("default", None)  # Missing means unchanged, not a request to set NULL.
    if patch:
        result["minProperties"] = 1
        result["description"] = "Chỉ gửi trường cần đổi; bỏ password nếu giữ nguyên. Không nhận PK/SKU/trường server tự gán."
    result["example"] = payload_example(name, patch)
    return result


def response_object(schema: dict, example: dict, description: str) -> dict:
    return {"description": description, "headers": {"Cache-Control": {"schema": {"type": "string"}, "example": "no-store"}},
            "content": {"application/json": {"schema": schema, "example": example}}}


def add_table_paths(spec: dict) -> None:
    templates = spec["paths"].pop("/api/data/{resource}")
    schemas = spec.setdefault("components", {}).setdefault("schemas", {})
    for name, resource in RESOURCES.items():
        base = resource.table
        read_ref = {"$ref": f"#/components/schemas/{base}Read"}
        schemas[f"{base}Read"] = row_schema(name)
        schemas[f"{base}Page"] = {
            "type": "object", "additionalProperties": False, "required": ["data", "total", "page", "page_size"],
            "properties": {"data": {"type": "array", "items": read_ref}, "total": {"type": "integer", "minimum": 0},
                           "page": {"type": "integer", "minimum": 1}, "page_size": {"type": "integer", "minimum": 1, "maximum": 100}},
        }
        if name in {"orders", "order-lines", "invoices", "payments", "voucher-uses"}:
            schemas[f"{base}Page"]["properties"]["order_id"] = {
                "type": "string", "description": "Mã đơn đã lọc chính xác; chỉ trả khi request có order_id.",
            }
        if resource.writable:
            schemas[f"{base}Saved"] = {"type": "object", "additionalProperties": False, "required": ["data"],
                                       "properties": {"data": {"type": "array", "items": read_ref}}}
        ops = {}
        for method in ["get"] + (["post", "patch"] if resource.writable else []):
            operation = deepcopy(templates[method])
            operation["operationId"] = f"{method}_{name.replace('-', '_')}"
            operation["tags"] = [RESOURCE_TAGS[name]]
            operation["security"] = [{"SessionCookie": []}]
            operation["x-roles"] = roles_for(name, method != "get")
            operation["x-table"] = resource.table
            operation["x-primary-key"] = list(resource.keys)
            operation["x-read-only"] = not resource.writable
            operation["x-implementation-status"] = "implemented-live-unverified"
            key = json.dumps(key_example(name), ensure_ascii=False, separators=(",", ":"))
            description = f"Bảng `{resource.table}`. Role: **{', '.join(operation['x-roles'])}**. "
            if method == "get":
                description += "Scope được lọc ở backend theo người đăng nhập, không tin role/ma_kh/ma_kho từ UI. "
                if resource.warehouse:
                    description += "THU_KHO chỉ xem kho/phiếu liên quan kho được gán; loại/sản phẩm/nhà cung cấp xem toàn bộ. "
                if name in CUSTOMER_READ:
                    description += "KHACH_HANG chỉ xem bản ghi của mình (cả khi truyền key của người khác). "
                description += "GET theo key vẫn trả mảng trong data; không có bản ghi trả 200 với data rỗng. "
                if name == "accounts":
                    description += "**Quản lý tài khoản dùng `/api/admin/accounts`, không dùng API ghi bảng chung.** "
                elif not resource.writable:
                    description += "**Chỉ đọc: chưa có API ghi nghiệp vụ cho bảng này.** "
            else:
                description += "Ghi database thật; không bấm Execute với dữ liệu mẫu trên database đang sử dụng. "
                description += "Không mở thao tác xóa. "
            description += f"\n\nKhóa chính: `{', '.join(resource.keys)}`. Ví dụ query `key={key}` (URL-encode khi gửi)."
            description += "\n\n" + NOTES.get(name, "Khóa ngoại phải tham chiếu dữ liệu tồn tại; kiểm tra constraint tại database.")
            operation["description"] = description
            operation["summary"] = {"get": "Danh sách / chi tiết", "post": "Thêm", "patch": "Chỉnh sửa"}[method] + " · " + resource.title
            parameters = [p for p in operation.get("parameters", []) if p["name"] != "resource"
                          and (p["name"] != "order_id" or name in {"orders", "order-lines", "invoices", "payments", "voucher-uses"})]
            for parameter in parameters:
                if parameter["name"] == "key":
                    parameter["description"] = f"Chuỗi JSON mảng khóa theo thứ tự {resource.keys}; int gửi JSON number, varchar gửi JSON string."
                    parameter["examples"] = {"primary_key": {"summary": "Dữ liệu giả minh họa; thay bằng khóa thật", "value": key}}
                if parameter["name"] == "q":
                    parameter["description"] = "Tìm chuỗi literal trong các trường varchar, không phân biệt hoa/thường; không tìm theo giá/số lượng."
                if parameter["name"] == "order_id":
                    parameter["description"] = "Lọc chính xác ma_donhang; kết hợp với key, tìm kiếm và phạm vi quyền của phiên. Không phải tìm kiếm gần đúng."
                if parameter["name"] == "page":
                    parameter["description"] = "Trang tính từ 1; sắp xếp ổn định theo khóa chính."
                if parameter["name"] == "page_size":
                    parameter["description"] = "Số bản ghi/trang, tối đa 100."
            if method != "get":
                parameters.append(deepcopy(ORIGIN_DOCUMENTATION))
            operation["parameters"] = parameters
            if method == "get":
                operation["responses"]["200"] = response_object({"$ref": f"#/components/schemas/{base}Page"},
                    {"data": [row_example(name)], "total": 1, "page": 1, "page_size": 20}, "Danh sách trong phạm vi quyền; data có thể rỗng.")
            else:
                model_name = f"{base}{'Update' if method == 'patch' else 'Create'}"
                schemas[model_name] = request_schema(name, method == "patch")
                operation["requestBody"] = {"required": True, "content": {"application/json": {
                    "schema": {"$ref": f"#/components/schemas/{model_name}"},
                    "examples": {"illustration": {"summary": "Chỉ là mẫu; không phải dữ liệu đã tạo", "value": payload_example(name, method == "patch")}},
                }}}
                status = "201" if method == "post" else "200"
                operation["responses"][status] = response_object({"$ref": f"#/components/schemas/{base}Saved"},
                    {"data": [row_example(name)]}, "Bản ghi đã lưu, không trả mật khẩu/hash.")
            ops[method] = operation
        spec["paths"][f"/api/data/{name}"] = ops


def describe_auth_and_public(spec: dict) -> None:
    paths = spec["paths"]
    for path, operations in paths.items():
        for method, operation in operations.items():
            if method not in {"get", "post", "patch", "put"}:
                continue
            if path.startswith("/api/admin/"):
                operation["security"] = [{"SessionCookie": []}]
                operation["x-roles"] = ["ADMIN"]
                operation["x-implementation-status"] = "implemented-live-unverified"
                if method != "get":
                    operation.setdefault("parameters", []).append(deepcopy(ORIGIN_DOCUMENTATION))
            elif path.startswith("/api/auth/"):
                operation["tags"] = ["Shared · Xác thực"]
                operation["security"] = [{"SessionCookie": []}] if path.endswith("/me") else []
                operation["x-implementation-status"] = "implemented-live-unverified"
            elif path == "/api/data/resources":
                operation["tags"] = ["Shared · Metadata"]
                operation["security"] = [{"SessionCookie": []}]
                operation["description"] = "Chỉ trả các bảng được phép theo phiên hiện tại. writable phản ánh quyền của role, không phải mọi bảng đều có API ghi. create_schema là JSON Schema cho body tạo; không có hash mật khẩu."
            elif path.startswith("/api/catalog/") or path == "/api/products":
                operation["tags"] = ["Customer · Catalog"]
                operation["security"] = []
            elif path == "/api/health":
                operation["tags"] = ["Shared · Hệ thống"]
                operation["summary"] = "Kiểm tra API đang chạy (không kiểm tra Supabase)"
                operation["security"] = []
                operation["responses"]["200"]["content"]["application/json"]["example"] = {"status": "ok"}
    for name in ["login", "logout"]:
        operation = paths[f"/api/auth/{name}"]["post"]
        operation.setdefault("parameters", []).append(deepcopy(ORIGIN_DOCUMENTATION))
        code = "200" if name == "login" else "204"
        operation["responses"][code].setdefault("headers", {})["Set-Cookie"] = {
            "description": "Cookie HttpOnly tự lưu ở trình duyệt." if name == "login" else "Xóa cookie ở trình duyệt; không thu hồi token đã bị sao chép phía server.",
            "schema": {"type": "string"},
        }
    login = paths["/api/auth/login"]["post"]
    login["description"] = "Tài khoản thật trong TAI_KHOAN, hash Argon2/bcrypt; role và kho lấy từ NHAN_VIEN/KHACH_HANG. Tạo cookie HttpOnly 8 giờ; không trả token trong JSON. Ví dụ password là placeholder, không có tài khoản demo."
    login["requestBody"]["content"]["application/json"]["example"] = {"username": "example.admin", "password": "Replace_with_your_password"}
    login["responses"]["200"]["content"]["application/json"]["example"] = SESSION_EXAMPLE
    paths["/api/auth/me"]["get"]["responses"]["200"]["content"]["application/json"]["example"] = SESSION_EXAMPLE
    paths["/api/auth/logout"]["post"]["description"] = "Xóa cookie phub_session. Không yêu cầu phiên còn hiệu lực; vẫn kiểm tra Origin. Thành công trả 204 không có body. Chưa có blacklist token/refresh token."


def install_openapi(app: FastAPI) -> None:
    def custom_openapi():
        if app.openapi_schema is not None:
            return app.openapi_schema
        spec = get_openapi(title=app.title, version=app.version, openapi_version=app.openapi_version,
                           description=app.description, routes=app.routes, tags=app.openapi_tags,
                           servers=[{"url": "/", "description": "Cùng origin với trang Swagger; tránh trộn hostname của cookie."}])
        spec.setdefault("components", {}).setdefault("securitySchemes", {})["SessionCookie"] = {
            "type": "apiKey", "in": "cookie", "name": COOKIE_NAME,
            "description": "Đăng nhập qua POST /api/auth/login trên cùng host để trình duyệt lưu cookie HttpOnly. Không nhập token hoặc Supabase key vào Authorize.",
        }
        add_table_paths(spec)
        describe_auth_and_public(spec)
        spec["x-database-schema"] = "database/schema.dbml"
        spec["x-live-database-verified"] = False
        spec["x-not-implemented"] = ["Customer authentication dependency integration", "Live deployment of customer checkout/payment RPCs", "Payment gateway/webhook/refund integration", "Registration/password reset/token refresh"]
        app.openapi_schema = spec
        return spec
    app.openapi = custom_openapi

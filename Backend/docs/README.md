# Quản lý và sử dụng PHUB Swagger / OpenAPI

OpenAPI là đặc tả JSON cho API. Swagger UI là trang để đọc đặc tả và thử request.
Nguồn chuẩn là code + `database/schema.dbml`; [openapi.json](openapi.json) là snapshot xuất từ ứng dụng để review trong Git hoặc import vào công cụ API.
Không sửa snapshot thủ công để thêm một endpoint chưa có code.

## Mở Swagger

Từ thư mục repository:

```powershell
cd Backend
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Nếu chưa có `.venv`/database/tài khoản, làm theo [Backend/README.md](../README.md) trước.

| Trang | URL |
| --- | --- |
| Swagger, đọc và thử API | http://localhost:8000/docs |
| ReDoc, đọc tài liệu | http://localhost:8000/redoc |
| Đặc tả OpenAPI đang chạy | http://localhost:8000/openapi.json |

Các trang tài liệu mở được kể cả khi chưa cấu hình Supabase; gọi API dữ liệu có thể trả 503 cho đến khi cấu hình xong. Swagger/ReDoc mặc định tải giao diện từ CDN, cần internet để hiển thị đầy đủ.

## Nhóm API

- **Shared**: xác thực, health và metadata.
- **Admin**: tổ chức (kho/nhân viên/tài khoản), khách hàng, sản phẩm, khuyến mãi.
- **Kho**: tồn kho, nhà cung cấp, phiếu nhập, chuyển kho.
- **Bán hàng**: đơn hàng, hóa đơn, thanh toán.
- **Customer**: catalog công khai và alias sản phẩm cũ (deprecated).

Có **29 đường dẫn, 47 thao tác**: 19 GET bảng và 18 POST/PATCH trên 9 bảng dữ liệu nền, cộng các API xác thực/catalog/metadata/health/alias. Đây là đặc tả chức năng **đã có code**, không phải xác nhận database thật đã chạy.

UI vẫn gọi các URL cũ `/api/data/products`, `/api/data/orders`, ... Backend vẫn dùng router `/api/data/{resource}`. Swagger tách thành từng đường dẫn cụ thể để payload và quyền không bị trộn lẫn. Các bảng chỉ đọc không hiện POST/PATCH. Không có DELETE hoặc checkout/webhook giả.

## Đăng nhập và thử

1. Cấu hình `.env` và tạo tài khoản thật trong database. Không có tài khoản demo cố định.
2. Nếu `.env` đã dùng cấu hình origin cũ, bổ sung `http://localhost:8000,http://127.0.0.1:8000` vào `FRONTEND_ORIGINS`, rồi restart backend. Không thay bằng wildcard `*`.
3. Mở Swagger bằng `localhost:8000` (cùng hostname với ba UI localhost).
4. Mở **Shared · Xác thực → POST /api/auth/login → Try it out**.
5. Đổi body mẫu thành username/email và mật khẩu tài khoản của bạn; bấm **Execute**. Password ví dụ trong docs chỉ là placeholder.
6. Response 200 kèm cookie HttpOnly `phub_session`; browser tự lưu cookie. Thử **GET /api/auth/me → Execute**, rồi endpoint theo role.
7. Khi xong, gọi **POST /api/auth/logout**. Đăng xuất chỉ xóa cookie trình duyệt, chưa có server-side blacklist token.

**Không nhập Supabase key hoặc dán token vào Authorize.** Cookie auth được mô tả trong OpenAPI, nhưng Swagger không thể tự đặt cookie HttpOnly qua Authorize. Trang này bật `withCredentials`; dùng cookie đã được browser lưu trên cùng host. Nếu công cụ/browser không gửi cookie, dùng Postman/cookie jar hoặc đăng nhập UI trên cùng host rồi thử lại.

POST/PATCH yêu cầu Origin tin cậy để chống CSRF. Browser tự gửi Origin của trang đang mở; dù Swagger hiển thị field Origin, bạn không thể giả một origin khác bằng field này. Trong Postman/CLI cần gửi `Origin: http://localhost:8000` (hoặc giá trị nằm trong cấu hình).

Không bấm thử request tạo/sửa trên dữ liệu thật khi chưa kiểm tra body: Execute thực sự ghi database, không phải mô phỏng.

## Ví dụ thao tác

### Xem sản phẩm

`GET /api/data/products`: để `key` trống để xem danh sách. Có thể điền `q`, `page`, `page_size` (tối đa 100).

Để xem một bản ghi, `key` phải là chuỗi JSON mảng khóa:

```json
["SP001"]
```

GET vẫn trả `{ "data": [...], "total": ..., "page": ..., "page_size": ... }`; không có bản ghi trong phạm vi quyền thì trả data rỗng, không phải 404. Key ví dụ phải được thay bằng mã tồn tại.

### Sửa ảnh sản phẩm

`PATCH /api/data/products`, `key=["SP001"]`, body:

```json
{
  "duong_dan_anh": "https://example.com/cpu.jpg"
}
```

Chỉ ADMIN có quyền. PATCH chỉ gửi trường thay đổi; PK và SKU bị chặn. Đây là URL ảnh, chưa có upload file. Chương trình khuyến mãi hiện không có cột ảnh trong DBML.

### Xem tồn kho với khóa ghép

`GET /api/data/inventory`, `key`:

```json
[1, "INTEL-I5-14400F"]
```

Thứ tự là `ma_kho` rồi `sku`; số phải là JSON number, mã là JSON string. THU_KHO chỉ xem kho được phân công. Không có API CRUD số lượng tồn.

### Tạo tài khoản

ADMIN gọi `POST /api/data/accounts`. Body có `password` (10–128 ký tự), không có `mat_khau_hash`. Gán **đúng một** `ma_kh` hoặc `ma_nhan_vien`. Mã người dùng phải tồn tại. Response không chứa password/hash.

## Đọc schema và lỗi

Mỗi endpoint có summary, tag, role, khóa chính, tham số, JSON request/response và ví dụ. Mở phần Schema trong request/response để biết trường bắt buộc, nullable và giới hạn.

- Tiền ở response là chuỗi decimal; không tính tiền bằng float JavaScript.
- Trường server tự gán (người/ngày tạo khuyến mãi, ngày tạo voucher) không nằm trong body.
- 401: chưa đăng nhập/phiên không hợp lệ.
- 403: role không được phép hoặc Origin bị chặn.
- 404: PATCH không tìm thấy bản ghi.
- 409: trùng dữ liệu unique.
- 422: sai payload/key, khóa ngoại hoặc check constraint.
- 429: login vượt 20 lần/IP/phút trong một process.
- 503: cấu hình/backend/database chưa sẵn sàng.

Auth/table dùng `{detail: ...}`; catalog giữ `{error: {code, message, details}}`. Đừng viết frontend chỉ đọc một kiểu lỗi cho cả hai nhóm.

## Cập nhật đặc tả trong Git

Khi thay đổi bảng/API:

1. Cập nhật DBML/migration và code thực tế.
2. Cập nhật mô tả/ví dụ nếu cần, restart backend và kiểm tra Swagger.
3. Xuất lại snapshot (từ thư mục Backend):

   ```powershell
   .venv\Scripts\python.exe scripts/export_openapi.py --output docs/openapi.json
   .venv\Scripts\python.exe scripts/export_openapi.py --check
   .venv\Scripts\python.exe -m pytest tests -q
   ```

4. Review và commit code + snapshot cùng nhau. Không đưa cookie, token, password thật hoặc `.env` vào ví dụ.

Snapshot kiểm tra drift theo nội dung JSON, không theo thứ tự/format. Export không gọi Supabase và không xuất giá trị `.env`. Có thể import `docs/openapi.json` vào Postman, rồi cấu hình base URL local của workspace; không import khóa đặc quyền Supabase.

## Cấu trúc phần đặc tả

```text
app/api_contracts.py       # Response/error/metadata contracts
app/api_examples.py        # Dữ liệu giả minh họa
app/documentation.py       # Metadata, tag, cookie auth, bảng cụ thể trong OpenAPI
app/resources.py           # Payload model dùng chung với validation runtime
scripts/export_openapi.py  # Xuất và kiểm tra snapshot
docs/openapi.json          # Snapshot cho Git/công cụ API
tests/test_openapi.py      # Validator OAS 3.1, ref, mẫu, quyền, URL, drift
```

OpenAPI mở rộng theo [cách chuẩn của FastAPI](https://fastapi.tiangolo.com/how-to/extending-openapi/). Giới hạn Authorize/cookie được mô tả trong [tài liệu Swagger](https://swagger.io/docs/specification/v3_0/authentication/cookie-authentication/).

# Quản lý và sử dụng PHUB Swagger / OpenAPI

OpenAPI là đặc tả JSON cho API. Swagger UI là trang để đọc đặc tả và thử request.
Nguồn chuẩn là code + `database/schema.dbml`; [openapi.json](openapi.json) là snapshot xuất từ ứng dụng để review trong Git hoặc import vào công cụ API.
Không sửa snapshot thủ công để thêm một endpoint chưa có code.

## Mở Swagger

Từ thư mục repository:

```powershell
cd Backend
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m uvicorn phub_api.main:app --reload --host 127.0.0.1 --port 8000
```

Nếu chưa có `.venv`/database/tài khoản, làm theo [Backend/README.md](../README.md) trước.

| Trang | Local | Render |
| --- | --- | --- |
| Swagger, đọc và thử API | [Swagger local](http://localhost:8000/docs) | [Swagger trên Render](https://phub-api.onrender.com/docs) |
| ReDoc, đọc tài liệu | [ReDoc local](http://localhost:8000/redoc) | [ReDoc trên Render](https://phub-api.onrender.com/redoc) |
| Đặc tả OpenAPI đang chạy | [OpenAPI local](http://localhost:8000/openapi.json) | [OpenAPI trên Render](https://phub-api.onrender.com/openapi.json) |
| Kiểm tra tiến trình API | [Health local](http://localhost:8000/api/health) | [Health trên Render](https://phub-api.onrender.com/api/health) |

Các trang tài liệu mở được kể cả khi chưa cấu hình Supabase; gọi API dữ liệu có thể trả 503 cho đến khi cấu hình xong. Swagger/ReDoc mặc định tải giao diện từ CDN, cần internet để hiển thị đầy đủ.

### Sử dụng bản deploy trên Render

- Base URL backend: `https://phub-api.onrender.com`; các endpoint vẫn có prefix `/api`, ví dụ [danh mục công khai](https://phub-api.onrender.com/api/catalog/categories).
- Website khách hàng: [PHUB trên Render](https://phub-platform.onrender.com). Swagger/ReDoc nằm ở service **phub-api**, không phải service website.
- Mở Swagger Render để thử API trên backend Render; không cần chạy backend local. Trong Postman, đổi base URL từ `http://localhost:8000` thành `https://phub-api.onrender.com`.
- Để đăng nhập hoặc thử các API ghi từ Swagger Render, thêm origin `https://phub-api.onrender.com` vào `FRONTEND_ORIGINS` của backend, giữ lại các origin UI đang dùng rồi restart/redeploy service. Browser tự gửi Origin; không thể sửa bằng ô nhập header trong Swagger.
- Cookie local và cookie Render là các phiên riêng; đăng nhập hoặc lấy Bearer token trên môi trường muốn kiểm thử. Request tạo/sửa từ Swagger Render ghi vào database mà backend Render đang cấu hình, không phải dữ liệu mô phỏng.
- Tài liệu online phản ánh phiên bản backend đã deploy, có thể khác snapshot local nếu chưa deploy mã mới. Health 200 chỉ xác nhận tiến trình chạy, không xác nhận database hoặc đăng nhập hoạt động.

URL service được đối chiếu với [cấu hình Render](../../render.yaml); xem [hướng dẫn deploy](../../RENDER.md) khi cần cập nhật service hoặc biến môi trường.

## Nhóm API

- **Shared**: xác thực, health và metadata.
- **Admin**: tổ chức (kho/nhân viên/tài khoản), khách hàng, sản phẩm, khuyến mãi.
- **Kho**: tồn kho, nhà cung cấp, phiếu nhập, chuyển kho.
- **Bán hàng**: đơn hàng, hóa đơn, thanh toán.
- **Customer**: catalog công khai và alias sản phẩm cũ (deprecated).

Có **49 đường dẫn, 70 thao tác**, gồm 19 GET bảng, 16 POST/PATCH trên 8 bảng dữ liệu nền, 11 thao tác tài khoản admin và các module xác thực/catalog/mua hàng. Đây là đặc tả chức năng **đã có code**, không phải xác nhận database thật đã chạy.

Quản lý tài khoản dùng nhóm **Admin · Tài khoản**, prefix `/api/admin`.
Xem [hợp đồng và các quy tắc tài khoản](modules/admin-accounts.md).
`GET /api/data/accounts` vẫn đọc được; tạo/sửa qua API bảng chung bị chặn.

UI vẫn gọi các URL cũ `/api/data/products`, `/api/data/orders`, ... Backend vẫn dùng router `/api/data/{resource}`. Swagger tách thành từng đường dẫn cụ thể để payload và quyền không bị trộn lẫn. Các bảng chỉ đọc không hiện POST/PATCH. Không có DELETE hoặc checkout/webhook giả.

## Lấy JWT và thử bằng Bearer (Swagger/Postman)

1. Mở **Shared · Xác thực → POST /api/auth/token → Try it out**.
2. Gửi JSON `{"username": "tài_khoản_hoặc_email", "password": "mật_khẩu_thật"}`.
3. Response gồm `access_token`, `token_type: "bearer"`, `expires_in: 28800` (8 giờ); endpoint không đặt cookie.
4. Bấm **Authorize → BearerAuth**, dán riêng `access_token`, **không thêm tiền tố `Bearer`**. Swagger tự thêm tiền tố khi gửi request.
5. Gọi **GET /api/auth/me**, rồi các API theo quyền tài khoản. Trong Postman, chọn Authorization → Bearer Token hoặc gửi header `Authorization: Bearer <access_token>`.

`/token` dùng chung kiểm tra username/email, mật khẩu, trạng thái/role và giới hạn 20 lần/IP/phút với `/login`.
Postman/CLI có thể bỏ Origin khi gọi `/token`; nếu gửi Origin thì phải thuộc `FRONTEND_ORIGINS`.
Các API ghi có yêu cầu Origin vẫn cần header này kể cả khi dùng Bearer.
Khi có Authorization, backend ưu tiên Bearer; header/token sai trả 401, không chuyển sang cookie.
Role và trạng thái tài khoản được đọc lại từ database mỗi request; đổi mật khẩu làm token cũ mất hiệu lực.
Khi xong, xóa token ở **Authorize → BearerAuth → Logout**. `/api/auth/logout` chỉ xóa cookie, không thu hồi Bearer token phía server.
Không nhập Supabase key vào Authorize. Swagger không lưu authorization qua lần tải lại trang.

## Đăng nhập và thử bằng cookie (luồng UI hiện tại)

1. Cấu hình `.env` và tạo tài khoản thật trong database. Không có tài khoản demo cố định.
2. Nếu `.env` đã dùng cấu hình origin cũ, bổ sung `http://localhost:8000,http://127.0.0.1:8000` vào `FRONTEND_ORIGINS`, rồi restart backend. Không thay bằng wildcard `*`.
3. Mở Swagger bằng `localhost:8000` (cùng hostname với ba UI localhost).
4. Mở **Shared · Xác thực → POST /api/auth/login → Try it out**.
5. Đổi body mẫu thành username/email và mật khẩu tài khoản của bạn; bấm **Execute**. Password ví dụ trong docs chỉ là placeholder.
6. Response 200 kèm cookie HttpOnly `phub_session`; browser tự lưu cookie. Thử **GET /api/auth/me → Execute**, rồi endpoint theo role.
7. Khi xong, gọi **POST /api/auth/logout**. Đăng xuất chỉ xóa cookie trình duyệt, chưa có server-side blacklist token.

Cookie auth được mô tả trong OpenAPI, nhưng ô **SessionCookie** trong Authorize không tự đặt cookie HttpOnly. Trang này bật `withCredentials`; dùng cookie đã được browser lưu trên cùng host. Xóa BearerAuth trước nếu muốn kiểm thử đúng phiên cookie. Nếu công cụ/browser không gửi cookie, có thể dùng luồng Bearer ở trên.

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

### Lọc dữ liệu liên quan đến một đơn hàng

`GET /api/data/order-lines?order_id=ORDER-001` (tương tự `invoices`, `payments`,
`voucher-uses`) lọc chính xác `ma_donhang` tại backend. Có thể kết hợp `q`, `key`,
`page`, `page_size`; tổng kết quả và phân trang tính sau khi lọc. Phạm vi quyền
khách hàng vẫn giữ nguyên. Tham số này không dùng cho các bảng không liên quan.
Response kèm `order_id` đã lọc, giúp UI phát hiện API cũ chưa hỗ trợ tham số này.

### Tạo tài khoản

ADMIN gọi `POST /api/admin/accounts`, không dùng `/api/data/accounts`. Form tạo mới gửi
`new_owner: { ho_ten, role, ma_kho }` cùng username, email và password (10–128 ký tự).
Không gửi `ma_tk`: database tự cấp mã `AD`/`KHO`/`KH` cộng số theo loại tài khoản;
response trả mã đã tạo để UI mở trang chi tiết.
Backend tạo người mới và tài khoản bằng một RPC transaction; cần migration
`Backend/migrations/20261010_admin_account_creation.sql`. Không nhận/trả hash từ UI.
Payload cũ gán đúng một `ma_kh`/`ma_nhan_vien` có sẵn vẫn được hỗ trợ để tương thích.

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
phub_api/schemas/api_contracts.py  # Response/error/metadata contracts
phub_api/schemas/examples.py   # Dữ liệu giả minh họa
phub_api/config/openapi.py     # Metadata, tag, cookie auth, bảng cụ thể trong OpenAPI
phub_api/models/resources.py    # Payload model dùng chung với validation runtime
scripts/export_openapi.py  # Xuất và kiểm tra snapshot
docs/openapi.json          # Snapshot cho Git/công cụ API
tests/test_openapi.py      # Validator OAS 3.1, ref, mẫu, quyền, URL, drift
```

OpenAPI mở rộng theo [cách chuẩn của FastAPI](https://fastapi.tiangolo.com/how-to/extending-openapi/). Giới hạn Authorize/cookie được mô tả trong [tài liệu Swagger](https://swagger.io/docs/specification/v3_0/authentication/cookie-authentication/).

## CRM: hồ sơ khách hàng Admin

**Cập nhật 23/10/2026:** đã bỏ sở thích, GET/PATCH chỉ trả `{profile, account}`.
Backend dùng RPC `admin_update_customer_profile_v2`, không đọc `SO_THICH` hoặc
`KHACH_HANG_SO_THICH`. Migration mới nhất là
`migrations/20261023012955_remove_customer_interests.sql` (đã áp dụng trên Phub,
không chạy lại); hai migration ngày 22/10 bên dưới chỉ còn là các bước lịch sử.
Deploy backend/frontend mới sau thay đổi này để không gọi các bảng đã bị xóa.

API mới: `GET/PATCH /api/crm/customers/{ma_kh}` và
`GET /api/crm/customers/{ma_kh}/orders`. Chỉ ADMIN được truy cập.
Sau migration hồ sơ/sở thích đợt 1, cần chạy thêm
`migrations/20261022_crm_admin_profile_api.sql` (đường dẫn tính từ `Backend/`)
để lưu nguyên tử. Không chạy lại script tạo bảng đã áp dụng.
Xem [hướng dẫn CRM Admin](../../docs/CRM-ADMIN-PROFILE.md) về scope, triển khai và kiểm thử.

## Lưu trữ mật khẩu hiện tại

Backend đã chuyển sang `TAI_KHOAN.mat_khau` và các RPC v2. Đọc [hướng dẫn triển khai đồng bộ và đặt lại mật khẩu cũ](PLAINTEXT_PASSWORDS.md) trước khi đổi database cloud. Các migration cũ là lịch sử, không sửa để xóa dấu vết schema cũ.

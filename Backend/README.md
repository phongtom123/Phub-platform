# PHUB Backend — FastAPI + Supabase

Kiến trúc: **trình duyệt → Next.js Route Handler → FastAPI Python → Supabase PostgreSQL**.
Không cần container. Next.js làm gateway cho UI; Python xử lý xác thực, phân quyền và dữ liệu.

## Chạy local trên Windows

Mở terminal tại thư mục repository và chạy:

```powershell
cd Backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Tạo `Backend/.env` dựa trên [.env.example](.env.example). Không commit file này.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_NEW_SERVER_ONLY_KEY
JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
FRONTEND_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:8000
COOKIE_SECURE=false
```

Lấy Project URL từ Supabase Dashboard → Project Settings → API/Data API. Tạo khóa bí mật mới trong API Keys.
Khóa từng gửi qua chat phải được thu hồi/thay mới; không đặt khóa vào biến `NEXT_PUBLIC_*`.
Sinh JWT secret bằng lệnh sau, rồi lưu giá trị vào `.env`, không gửi qua chat:

```powershell
.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
.venv\Scripts\python.exe -m uvicorn phub_api.main:app --reload --host 127.0.0.1 --port 8000
```

- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI: http://localhost:8000/openapi.json
- Liveness: http://127.0.0.1:8000/api/health (không kiểm tra DB).
- Test: `.venv\Scripts\python.exe -m pytest tests -q`.

Swagger có 70 thao tác, schema riêng cho từng module, role và mã lỗi. Xem [hướng dẫn Swagger/OpenAPI](docs/README.md) để đăng nhập thử bằng Bearer/cookie và cập nhật snapshot [docs/openapi.json](docs/openapi.json). Trang docs không cần Supabase để mở; thử API dữ liệu cần cấu hình thật. `.env` cũ cần thêm origin cổng 8000 nếu muốn thử POST/PATCH/PUT trực tiếp từ Swagger.

## Xử lý kết nối lỗi tạm thời (503)

Backend dùng HTTP client/pool chung cho Supabase, HTTP/1.1, tối đa 20 kết nối
và 10 kết nối giữ lại. Timeout mỗi thao tác: connect 2 giây, read 4 giây,
write 10 giây, chờ pool 1 giây. Đây không phải giới hạn thời gian toàn endpoint.
HTTP/1.1 là lựa chọn thận trọng, chưa chứng minh HTTP/2 gây lỗi trên Render.

GET/HEAD không có body được thử tối đa 3 lượt (lượt đầu + 2 retry) khi gặp
ConnectError/ConnectTimeout/ReadError/ReadTimeout/RemoteProtocolError hoặc
HTTP 502/503/504. Retry chờ 0,25 rồi 0,5 giây kèm jitter; không bắt đầu retry
nếu vượt ngân sách 8 giây. Không retry lỗi pool/429/4xx, không replay
POST/PATCH/PUT/DELETE hoặc transaction RPC: ghi dữ liệu có thể đã thành công
trước khi kết nối mất. UI/gateway không retry thêm để tránh nhân số lượt gọi.

Log lỗi mạng ghi loại exception, phương thức, route; log retry ghi host và
thời gian. Không ghi query, body, token, mật khẩu hoặc nội dung exception.
Kiểm tra `Database read retry` / `Database connection failed` để tìm nguyên nhân;
`503` không tự chứng minh bảng/schema sai. Health 200 chỉ là liveness.

Kiểm thử offline: `.venv\Scripts\python.exe -m pytest tests/test_database_transport.py -q`.
Để thử Supabase thật từ backend local, điền `SUPABASE_SECRET_KEY` trong `.env`,
chạy uvicorn và đặt `ui/adminUI/.env.local`:
`PHUB_API_BASE_URL=http://127.0.0.1:8000`; khởi động lại admin. Đăng nhập lại vì
JWT secret local có thể khác Render. Không cần SQL migration cho thay đổi này.

## Chuẩn bị database

Danh mục là danh sách phẳng: catalog trả `id/name` và lọc đúng các loại đã chọn.
Không cần migration danh mục cha–con. Nếu database từng thêm cột cha thì bản này
không đọc hoặc ghi cột đó; các danh mục và sản phẩm hiện có vẫn được giữ.

Nguồn chuẩn là [schema.dbml](schema.dbml), gồm 22 bảng, SKU, loại sản phẩm, media dùng chung và tổng tiền giảm trên hóa đơn, không có bảng chi nhánh.

Nếu Supabase **chưa có bảng/dữ liệu**, kiểm tra rồi chạy [001_initial_schema.sql](migrations/001_initial_schema.sql) trong SQL Editor. Script có transaction, 36 khóa ngoại, check constraints, RLS và chặn truy cập bảng trực tiếp từ vai trò `anon`/`authenticated`.

Nếu database **đã tồn tại**, không chạy migration tạo mới và không xóa bảng để chạy lại. So sánh tên bảng/cột/khóa ngoại với DBML trước; cần migration nâng cấp riêng. Các bảng dùng tên viết hoa có dấu nháy kép, ví dụ `public."SAN_PHAM"`. Quan hệ FK cần tồn tại để PostgREST lọc theo khách hàng/kho qua các bảng chi tiết.

Vì Python dùng khóa đặc quyền bỏ qua RLS, toàn bộ quyền truy cập được kiểm tra tại API. Database đang có dữ liệu cũng phải bật RLS/chặn API bảng công khai; không dùng UI-only guards thay cho phân quyền. Không chạy script seed cũ mặc định: script đó có dữ liệu điện thoại/laptop và ghi vào DB, không phù hợp danh mục PC hiện tại.

### Tài khoản đầu tiên

Backend hiện đọc mật khẩu dạng chữ trong `TAI_KHOAN.mat_khau` theo lựa chọn của dự án. Trước khi dùng code này trên database cũ, xem [hướng dẫn chuyển đổi](docs/PLAINTEXT_PASSWORDS.md). Không xóa cột cũ trên Render/Supabase khi backend cũ còn phục vụ.

Để tạo admin đầu tiên trên database đã chuyển đổi, tạo `NHAN_VIEN` có `loai_nhan_vien=ADMIN`, `ma_kho=NULL`, `trang_thai=1`; tạo tài khoản liên kết với `mat_khau` 10–128 ký tự, `ma_kh=NULL`, trạng thái 1. Admin sau đó tạo các tài khoản khác qua UI/API. Nhân viên kho phải được phân kho. Không còn dùng script `hash_password.py`.

## API đã có

### Xác thực

| Endpoint | Mục đích |
| --- | --- |
| `POST /api/auth/login` | `{ "username": "...", "password": "..." }`, username hoặc email |
| `POST /api/auth/token` | Cùng body đăng nhập; trả `access_token`, `token_type: "bearer"`, `expires_in: 28800` cho Swagger/Postman |
| `POST /api/auth/register` | Tạo nguyên tử hồ sơ + tài khoản khách hàng và đăng nhập ngay |
| `GET /api/auth/me` | Tài khoản/role/kho đang đăng nhập |
| `POST /api/auth/logout` | Xóa cookie phiên ở trình duyệt |

Cookie `phub_session`: HttpOnly, SameSite=Lax, 8 giờ. `/login` và `/register` không trả token trong JSON; UI không lưu token ở localStorage. `/token` trả JWT trong JSON, không đặt cookie, dùng chung `authenticate_credentials` và `create_access_token` với đăng nhập cookie. Trong Swagger chọn **Authorize → BearerAuth** và dán riêng token, không thêm `Bearer`; xem [hướng dẫn test](docs/README.md#lấy-jwt-và-thử-bằng-bearer-swaggerpostman).

`current_user` nhận Bearer hoặc cookie và dùng chung `verify_access_token`. Khi có Authorization thì ưu tiên Bearer; header/token sai trả 401, không chuyển sang cookie. Mỗi request đọc lại role/trạng thái DB; thay mật khẩu làm vô hiệu token cũ. Mật khẩu lưu nguyên văn ở `mat_khau`, so sánh đúng ký tự/khoảng trắng; không đọc hash cũ. Dấu phiên mật khẩu là HMAC với JWT secret, không nhúng mật khẩu vào JWT. Admin có API cấp lại mật khẩu và tự đổi mật khẩu. Chưa có refresh token, quên mật khẩu qua email, xác minh email hoặc thu hồi từng token bị đánh cắp. Đăng xuất chỉ xóa cookie; token Bearer đã cấp vẫn có hiệu lực đến khi hết hạn hoặc tài khoản/mật khẩu mất hiệu lực.

Database mới chạy lịch sử migration rồi `migrations/20261024161801_account_plaintext_passwords.sql`; xem hướng dẫn chuyển đổi trước khi chạy trên database có tài khoản. Đăng ký dùng RPC `customer_register_v2`. RPC chỉ cấp `EXECUTE` cho `service_role`; browser gọi backend qua `/api/backend/auth/register`, không nhận Supabase secret. Hai bản ghi `KHACH_HANG` và `TAI_KHOAN` được tạo trong cùng transaction nên không để lại hồ sơ dở dang khi username/email bị trùng. Đăng ký giới hạn 5 lần/IP/phút trong một process.

Ba cổng dùng cùng một cơ chế: `current_user` xác minh JWT và tải lại danh tính từ
database; `require_admin`, `require_warehouse`, `require_customer_user` kiểm tra
role và dữ liệu bắt buộc của từng cổng. `require_customer` chỉ chuyển danh tính
khách đã xác minh sang model commerce. Các UI gọi chung `ui/shared/auth-client.ts`
qua gateway `/api/backend/auth/*`; không UI nào tự decode JWT hoặc giữ token.

Các API ghi có yêu cầu `Origin` vẫn cần giá trị nằm trong `FRONTEND_ORIGINS`, kể cả khi dùng Bearer. Riêng `/token` cho Postman/CLI bỏ Origin; nếu gửi thì phải thuộc allowlist. `/login` và `/token` dùng chung giới hạn 20 lần/IP/phút trong **một process**. Triển khai nhiều worker cần shared limiter, HTTPS và `COOKIE_SECURE=true`. Ba cổng localhost dùng chung cookie trên cùng host; không trộn `localhost` với `127.0.0.1` cho URL của ba UI.

### Tài khoản admin

11 thao tác ở `/api/admin`: danh sách/tìm kiếm/phân trang, tra cứu chủ tài khoản,
tạo/chi tiết/sửa, ẩn–khóa–mở lại, đổi quyền nhân viên, cấp lại mật khẩu và quản lý
tài khoản đang đăng nhập. UI riêng ở `/accounts`, `/accounts/new`,
`/accounts/{id}`, `/accounts/{id}/edit`, `/account`.

Xem [hợp đồng API và cách kiểm thử](docs/modules/admin-accounts.md). Không cần đổi
schema bảng cho module này nếu database đã khớp DBML và có các FK/unique/check hiện có.
Form tạo mới cần cài sequence và hàm RPC bằng `migrations/20261010_admin_account_creation.sql`:
tạo người mới và tài khoản trong một transaction, không chọn hồ sơ cũ, không để lại
hồ sơ dở dang khi lỗi trùng username/email. Mã nhân viên/khách do backend tự sinh.
Mã tài khoản do database tự cấp theo loại: `AD` (admin), `KHO` (nhân viên kho), `KH` (khách)
cộng số tự tăng, tối thiểu 6 chữ số. UI không nhập mã; các mã tài khoản cũ giữ nguyên.
Không có DELETE; tài khoản bắt buộc gắn với đúng một nhân viên/khách. Chỉ ADMIN truy cập.
API generic của accounts chỉ đọc, không thể dùng nó để bỏ qua quy tắc quản lý tài khoản.

### Table API

- `GET /api/data/resources`: bảng/trường/khóa/kiểu/khả năng ghi theo role, kèm JSON Schema để tạo dữ liệu.
- `GET /api/data/{resource}?page=1&page_size=20&q=...`: phân trang/tìm kiếm. Response `{data,total,page,page_size}`. `page_size` tối đa 100; thứ tự ổn định theo PK.
- `GET /api/data/{resource}?key=[...]`: chi tiết theo khóa chính. `key` là mảng JSON: `products?key=["SP001"]`; `inventory?key=[1,"CPU-001"]`. UI tự URL-encode mảng này.
- `POST /api/data/{resource}`: tạo dữ liệu nền, validate trường/kiểu/default/FK/check constraints.
- `PATCH /api/data/{resource}?key=[...]`: cập nhật một bản ghi, chỉ gửi trường thay đổi. Không sửa khóa chính hoặc SKU của sản phẩm; không có DELETE.

| Resource | Table | Ghi trực tiếp |
| --- | --- | --- |
| warehouses | KHO | ADMIN |
| employees | NHAN_VIEN | ADMIN |
| accounts | TAI_KHOAN | Chỉ đọc; ghi qua `/api/admin/accounts` |
| customers | KHACH_HANG | ADMIN |
| categories | LOAI_SP | ADMIN |
| products | SAN_PHAM | ADMIN |
| inventory | TON_KHO | Chỉ đọc |
| suppliers | NHA_CUNG_CAP | ADMIN, NHAN_VIEN |
| receipts / receipt-lines | PHIEU_NHAP / CT_PHIEU_NHAP | Chỉ đọc |
| transfers / transfer-lines | PHIEU_CHUYEN_KHO / CT_CHUYEN_KHO | Chỉ đọc |
| orders / order-lines | DON_HANG / CT_DON_HANG | Chỉ đọc |
| invoices / payments | HOA_DON / THANH_TOAN | Chỉ đọc |
| promotions / vouchers | CHUONG_TRINH_KHUYEN_MAI / VOUCHER | ADMIN |
| voucher-uses | SU_DUNG_VOUCHER | Chỉ đọc |

ADMIN xem 20 tài nguyên qua API dữ liệu chung; media và hỗ trợ khách hàng có endpoint chuyên biệt. NHAN_VIEN chỉ xem danh mục/sản phẩm/nhà cung cấp và kho, tồn, phiếu thuộc kho được gán. Khách chỉ xem thông tin/đơn/chi tiết đơn/hóa đơn/thanh toán/lượt voucher của mình. Bản ghi ngoài phạm vi không trả về dù truyền PK hợp lệ.

Account payload dùng `password`, không nhận trường lưu trữ `mat_khau`/`mat_khau_hash`. Các API đọc không trả mật khẩu. Lưu ý database chủ ý lưu mật khẩu dạng chữ theo cấu hình dự án. Money trả dạng chuỗi decimal, không dùng float JavaScript để tính tổng. Người/ngày tạo khuyến mãi và ngày tạo voucher do backend gán. Chuẩn hóa code voucher uppercase. Ảnh sản phẩm upload qua API media; `duong_dan_anh` vẫn được đồng bộ sang ảnh chính trong `MEDIA` để tương thích form cũ. Schema chương trình khuyến mãi **không có cột ảnh**, nên chưa lưu ảnh chương trình vào DB.

Catalog công khai hiện có `/api/catalog/products`, `/products/{ma_sp}`, `/categories`, `/brands` (giữ response contract cũ). Alias `/api/products` còn trả mảng, giới hạn trường công khai và sản phẩm/loại đang hoạt động; ưu tiên API catalog cho tính năng mới.

## Phần chưa triển khai

Đây là nền API + CRUD dữ liệu nền, **không phải toàn bộ nghiệp vụ backend đã hoàn thành**. Các API ghi đơn hàng/dòng hàng/hóa đơn/thanh toán/phiếu nhập/chuyển kho/tồn/sử dụng voucher cố ý bị chặn.

Bước tiếp theo cần PostgreSQL RPC/transaction cho:

1. Tạo/sửa phiếu nhập nháp và xác nhận nhập: tăng tồn một lần, chống xác nhận trùng.
2. Tạo/xuất/nhận phiếu chuyển: khóa tồn, chặn âm tồn, xác nhận idempotent.
3. Checkout/áp voucher/hủy đơn: giá do server chốt, mỗi đơn tối đa một voucher, kiểm tra giới hạn lượt theo khách bằng transaction.
4. Xuất kho/hoàn thành/lập hóa đơn: snapshot giá/thuế/discount; tính tiền bằng Decimal/PostgreSQL numeric.
5. Thanh toán/webhook/hoàn tiền: xác minh provider và chống ghi nhận trùng mã giao dịch.

Không thực hiện nhiều `.insert/.update` liên tiếp qua HTTP rồi coi đó là transaction. Cũng cần kiểm thử live Supabase, E2E browser và cạnh tranh dữ liệu trước khi hoàn thành các Issue tương ứng trên Project.

## Cấu trúc

Luồng xử lý: **`controllers → services → repositories → database`**.
Hướng dẫn chi tiết, ví dụ tạo tài khoản và quy tắc thêm chức năng:
[ARCHITECTURE.md](ARCHITECTURE.md).
`models` chứa đối tượng nội bộ; `schemas` định nghĩa dữ liệu nhận/trả qua API.
Middleware được đăng ký tại `main.py`; CORS nằm trong `middleware/cors.py`,
xác thực/phân quyền dùng `Depends()` trong `dependencies/auth.py`.

```text
phub_api/
  __init__.py
  main.py          # Khởi tạo FastAPI và đăng ký router/middleware
  config/          # Settings, Supabase pool/transport và OpenAPI
  controllers/     # Khai báo endpoint + nhận request, gọi service, trả response
  dependencies/    # Guard xác thực/phân quyền và factory dependency
  middleware/      # CORS, exception handler và chuẩn hóa lỗi
  models/          # Danh tính, lỗi nghiệp vụ và metadata bảng
  repositories/    # Truy vấn và thao tác dữ liệu
  schemas/         # Pydantic request/response, model động, ví dụ OpenAPI
  services/        # Quy tắc nghiệp vụ, token, upload và checkout
docs/modules/       # Hợp đồng và ghi chú theo từng module
scripts/            # Công cụ kiểm tra và hỗ trợ vận hành
tests/              # Offline HTTP/PostgREST mocks
```

Không còn package `api/` trung gian. Controller không import repository/Supabase;
service không nhận Request/Response hoặc truy vấn DB; repository không gọi ngược
service. Các factory trong `dependencies/` ghép lớp và giữ khả năng override
trong test. `tests/test_architecture.py` kiểm tra các ranh giới này tự động.


---

# Backend và tích hợp giao diện khách hàng

Bốn mục tiêu đã có code: catalog công khai, đặt đơn, tra cứu thanh toán và nối
luồng mua hàng vào UI desktop/mobile. Dùng FastAPI/Supabase client sẵn có; không
sửa UI admin/kho, cấu trúc của thành viên khác hoặc `GET /api/products`
cũ. CORS có cấu hình theo env để deploy, giữ mặc định localhost hiện có.
Khóa Supabase chỉ ở Backend. Tài liệu từng module mô tả file và hợp đồng API.

Hướng dẫn chạy thử từng chức năng UI: [CUSTOMER-TESTING.md](../CUSTOMER-TESTING.md).
Phiên khách đầu tiên đã được cho phép trên Supabase thật:
[CUSTOMER-SUPABASE-TESTING.md](../CUSTOMER-SUPABASE-TESTING.md).
Chế độ `SupabaseTest` chỉ local, không sửa auth production. Mặc định tạm ngắt
đăng nhập, tự dùng khách đầu tiên; `-RequireTestSession` bật lại phiên cookie.
Cấu hình Render và module đăng nhập của nhóm giữ nguyên. Catalog/hồ sơ/giỏ
đã kiểm tra qua UI thật; hai API thanh toán của đơn có sẵn trả 200. Quote/tạo/đọc
đơn còn thiếu RPC và kết nối SQL để cài; chưa chứng nhận checkout thật hoàn chỉnh.
Cài đặt và cấu hình Render để tự triển khai sau:
[CUSTOMER-DEPLOYMENT.md](../CUSTOMER-DEPLOYMENT.md). Có script start/stop từ source,
health check, production URL và smoke test chỉ đọc. Xác thực thật/migration vẫn
giữ điểm bàn giao cho thành viên tương ứng.

Bản chạy local bổ sung đã kiểm tra: **309 Python tests**, production build và
lint các file thay đổi; **15 nhóm E2E mua hàng** cùng **5 nhóm test trang điều
khiển fixture bằng thao tác UI**. Đã sửa lỗi mất voucher khi nhấn Link từ giỏ
sang checkout, có kiểm thử đối chiếu tổng đơn để ngăn tái xuất hiện.

Thay đổi tạm ngắt đăng nhập: 215 tests liên quan đặt đơn/thanh toán/commerce/
phiên local đạt, gồm 19 tests local. Browser kiểm tra trực tiếp UI không cookie
và tải lại trang; dùng cùng khách cố định, không sửa authentication production.

## Trạng thái

| Phần | Hiện tại |
| --- | --- |
| Catalog/chi tiết | Đã nối Supabase và UI desktop/mobile |
| API tạo đơn, snapshot, tồn và idempotency | Đã viết và kiểm thử |
| API hồ sơ, quote/voucher, lịch sử/chi tiết đơn | Đã viết và cập nhật Swagger |
| API thanh toán/lịch sử thu và hoàn tiền | Đã viết, chỉ đọc các bảng hiện có |
| Giỏ, checkout, đơn và màn hình thanh toán | Đã nối API, đạt E2E bằng fixture riêng |
| Xác thực thật | **Chờ module của thành viên phụ trách**; API khách mặc định 503 trước khi đọc/ghi DB |
| Phiên khách test local trên Supabase thật | Đã nối khách đầu tiên `SEED_KH001`, cookie HttpOnly; không sửa đăng nhập của nhóm |
| Migration Supabase chung | **Chưa áp dụng**; cần nhóm database/kho/khuyến mãi review staging |
| E2E đăng nhập thật → đặt đơn trên Supabase chung | Chờ hai điều kiện trên, chưa chứng nhận |
| Đăng ký/đăng nhập, xuất kho, hóa đơn, thu tiền | Giữ trách nhiệm các thành viên tương ứng |

Kiểm thử local/giả lập không có nghĩa đã triển khai database chung hoặc đăng nhập
thật. UI không giả khách đã đăng nhập hoặc báo đặt thành công khi backend lỗi.
Catalog vẫn công khai khi phần tài khoản chưa sẵn sàng.

## Mục tiêu 1 — Catalog công khai

Swagger **Public Catalog**: `GET /api/catalog/products`, `/products/{product_id}`,
`/categories`, `/brands`. Danh sách tìm tên/SKU bằng `q`, lọc `category_id` lặp,
`brand`, phân trang `page/page_size`, sắp `default/price-asc/price-desc`.
Lọc/sắp tại database trước phân trang; sản phẩm và loại phải hoạt động, mặc định
trạng thái 1. Chi tiết dùng `ma_sp`, trả ảnh/mô tả/thông số/đơn vị/bảo hành.
Tiền là chuỗi; không giả tồn kho/rating/giảm giá. Kết quả rỗng không fallback fixtures.

`phub_api/schemas/catalog.py` chứa validation/model công khai,
`phub_api/repositories/catalog.py` truy vấn dữ liệu; `phub_api/services/catalog.py`
ánh xạ ảnh/thông số, lọc màu/tồn khả dụng và dựng kết quả,
`phub_api/controllers/catalog.py` xử lý request,
controller này cũng khai báo routes/Swagger; `phub_api/middleware/catalog_errors.py` chuẩn hóa lỗi riêng module.
UI nối proxy GET, home, search header, catalog grid/list, filter, preview/detail
desktop/mobile; query trong URL, loading/error/retry/not-found và ảnh placeholder.
Tài liệu: [catalog README](docs/modules/catalog.md),
[CATALOG-INTEGRATION.md](../ui/userUI/Frontend/CATALOG-INTEGRATION.md).

## Mục tiêu 2 — Đặt đơn

Swagger **Customer Orders**: `POST /api/orders`, body/receipt không voucher vẫn
giữ nguyên, kể cả cùng SKU phân bổ vào nhiều kho. Mục tiêu 4 bổ sung xác thực
chung và transaction v2 để gắn `DON_HANG.ma_kh`; không còn cho guest tạo đơn.
Checkout mới dùng `POST /api/customer/orders` có voucher. Không tin mã khách hoặc
giá chốt từ frontend. Validate người nhận, địa chỉ, SKU/kho, số lượng 1–1000,
tối đa 100 dòng, UUID v4 và giá đối chiếu dạng chuỗi.

Transaction khóa sản phẩm/tồn, kiểm tra giá và lượng khả dụng, chốt tên/đơn vị/
đơn giá, tính dòng/tổng, ghi đơn/chi tiết/key nguyên khối. Lỗi rollback tất cả.
Cùng khách/key/body trả receipt cũ 200; đơn mới 201; khác body/khách trả 409.
Timeout cần retry cùng key/body. Không tự tạo hóa đơn hoặc thanh toán.

`phub_api/schemas/orders.py` chứa request/receipt; `phub_api/config/orders.py`
chứa quy tắc đã xác nhận; `phub_api/services/orders.py` điều phối use case/lỗi allowlist;
`phub_api/repositories/orders.py` gọi transaction RPC; `phub_api/controllers/orders.py`
và `phub_api/middleware/order_errors.py` xử lý HTTP/Swagger/lỗi.
Migration 04/10 tạo schema key riêng và RPC v1; migration 06/10 bổ sung v2 hiện dùng.
Tài liệu file/request/triển khai: [orders README](docs/modules/orders.md).

## Mục tiêu 3 — Thanh toán và lịch sử giao dịch

Swagger **Customer Payments**: `GET /api/orders/{order_id}/payments` giao dịch
mới nhất, `GET /api/orders/{order_id}/transactions` lịch sử phân trang mới trước.
Lớp payment chỉ đọc `DON_HANG`, `THANH_TOAN`, không cần migration payment.
Kiểm tra chủ đơn rồi lọc lại quyền sở hữu ở truy vấn giao dịch. Đơn không tồn tại,
khách khác hoặc `ma_kh=NULL` cùng 404. Tiền là chuỗi Decimal; không trả mã thanh
toán/tham chiếu/payload nhạy cảm. Thành công/lỗi đều `no-store`.

`CHO_XU_LY` → `pending`, thông báo chưa xác nhận thành công. Chưa có giao dịch
không phải đã thanh toán; một khoản thu hoặc hoàn tiền không xác nhận toàn đơn
đã tất toán. UI có trạng thái/lịch sử trên chi tiết đơn và nút cập nhật.

`phub_api/dependencies/customer.py::require_customer` dùng trực tiếp danh tính từ
`phub_api/services/auth.py`: JWT trong cookie HttpOnly được kiểm tra chữ ký/hết hạn, sau đó
tài khoản, trạng thái, role và liên kết `TAI_KHOAN.ma_kh` được tải lại từ database.
Không tin bearer chưa xác minh, `X-Customer-Id` hoặc mã khách do client tự khai báo.
Tài liệu file/handoff: [payments README](docs/modules/payments.md).

## Mục tiêu 4 — Luồng mua hàng khách hàng

Swagger **Customer Shopping**:

| Endpoint | Chức năng |
| --- | --- |
| `GET /api/customer/me` | Hồ sơ công khai của khách đã xác minh |
| `POST /api/customer/checkout/quote` | Giá/tồn/kho/voucher và tổng tiền |
| `PUT /api/customer/me` | Lưu thông tin nhận hàng của khách đã xác minh; không cần migration mới |
| `POST /api/customer/orders` | Đơn thuộc khách, voucher và idempotency |
| `GET /api/customer/orders` | Lịch sử đơn có phân trang |
| `GET /api/customer/orders/{order_id}` | Chi tiết và snapshot của đơn thuộc khách |

Các controller/view commerce dùng cùng dependency khách cho mọi route. Quote chọn một kho đủ
hàng mỗi SKU; checkout mới nhận một dòng mỗi SKU. Voucher phải hoạt động, đúng
hạn, đạt tối thiểu và còn lượt toàn hệ thống/mỗi khách. Tạo đơn kiểm tra lại,
khóa quota, ghi usage voucher cùng đơn/key. Phân bổ giảm giá tới từng dòng và
tổng khớp chính xác đến hai số thập phân. Quote không giữ hàng hoặc lượt voucher.

Frontend proxy cùng origin forward credential tới backend cố định. Provider
quản lý hồ sơ/giỏ từng khách; catalog/detail nối nút thêm, header count thật,
cart chỉnh/xóa số lượng, checkout nhập người nhận và xác nhận quote. Mất phản
hồi giữ UUID/body để retry sau reload. Hồ sơ/đơn/payment dùng dữ liệu đã xác minh;
chi tiết lấy snapshot lúc bán. Không sửa đăng ký/đăng nhập, thu thập thẻ/CVV hay
dùng phí/voucher mẫu. Tài liệu hợp đồng/file/migration:
[commerce README](docs/modules/commerce.md). File map frontend, lưu trữ, auth handoff
và hướng dẫn test cả luồng: [SHOPPING-INTEGRATION.md](../ui/userUI/Frontend/SHOPPING-INTEGRATION.md).

## Nghiệp vụ đã xác nhận

- Giá catalog/đơn **trước thuế**; dòng đỏ nhỏ “chưa áp dụng thuế 10%” cạnh giá.
  Đặt đơn chốt thuế suất 10%, tiền thuế 0; phần hóa đơn mới áp thuế.
- Tổng checkout = tiền sản phẩm − voucher. Phí vận chuyển xác nhận riêng;
  chưa có API/schema phí, không suy ra giao hàng miễn phí.
- Tạo đơn giữ hàng bằng chi tiết, **không trừ tồn thực**.
  Tồn khả dụng = TON_KHO − chi tiết đơn MOI/XAC_NHAN/DANG_CHUAN_BI.
  Kho trừ tồn thực và đổi trạng thái xuất nguyên khối, tôn trọng giữ hàng/khóa tồn.
- Hủy nhả giữ hàng. Nhả lượt voucher cần nhóm sở hữu luồng hủy chuyển usage sang
  DA_HUY. Không sửa phiếu xuất, luồng hủy hoặc hóa đơn của nhóm khác.
- Quy tắc cấu hình: `ORDER_STOCK_POLICY=reserve_on_order`,
  `ORDER_PRICE_TAX_MODE=exclusive`, `ORDER_TAX_RATE=10`, `ORDER_TAX_APPLICATION=invoice`.
  Cấu hình trái quy tắc bị từ chối. Promo timestamp không timezone đọc theo
  `CHECKOUT_PROMOTION_TIMEZONE=Asia/Ho_Chi_Minh`, cần nhóm xác nhận; giữ tiền tệ
  cố định cho các đơn đã lưu do schema chung chưa có cột tiền tệ từng đơn.

## Chạy và kiểm thử

Từ Backend, terminal riêng:

```powershell
.\.venv\Scripts\python.exe -m uvicorn phub_api.main:app --host 127.0.0.1 --port 8001
```

Swagger `http://127.0.0.1:8001/docs`, OpenAPI `/openapi.json`; có cả bốn nhóm.
Port 8001 tránh cổng 8000 đã gặp WinError 10013. Frontend dùng
`PHUB_API_BASE_URL=http://127.0.0.1:8001` ở terminal khác; xem tài liệu UI về Windows/WASM.
Link không tự chạy server: phải giữ terminal mở. Khi auth/migration chưa nối,
catalog dùng dữ liệu thật; không bỏ chặn xác thực để test đặt đơn.

```powershell
# Không ghi Supabase
.\.venv\Scripts\python.exe -m pytest -q
# Chỉ đọc nếu cần kiểm tra Supabase
.\.venv\Scripts\python.exe scripts/check_catalog.py
.\.venv\Scripts\python.exe scripts/check_payments_schema.py
```

Mục tiêu 4 đạt **271 Python tests**: 75 catalog, 72 orders, 68 payments, 56 commerce;
**26 kiểm tra PostgreSQL checkout riêng**; TypeScript, lint các file tích hợp và
production build; **15 nhóm kiểm tra trình duyệt fixture**. Browser kiểm tra guest,
login handoff giả lập, cart/voucher/người nhận, mobile/desktop, đổi giá, nhấp đúp,
mất phản hồi/reload/retry, snapshot, giao dịch chờ/hoàn, pagination, tách hai khách,
sản phẩm không tải được và xác thực chưa sẵn sàng. Auth/database giả lập không
thay thế SQL thật hoặc đăng nhập thật. Chi tiết lệnh test trong README UI/commerce.

Các mục tiêu trước đã đạt catalog Supabase 17 chỉ đọc, payment schema 5 chỉ đọc,
SQL v1 25 local và catalog browser 27. Đây là các lần kiểm tra trước, không phải
tất cả đều chạy lại trong mục tiêu 4. SQL/Chrome dùng công cụ tạm ngoài repo.

Migration chung còn chờ review: `migrations/inspect_order_schema.sql` chỉ đọc,
kiểm tra trigger/constraints/FK/ID generator/quyền rồi staging theo thứ tự
04/10 → 06/10. Không triển khai test fixture lên Supabase hoặc tự áp migration
khi startup; không thay dependency/lockfile của các thành viên khác.


## Integration status on feat/backend-middleware-api

The shared JWT/cookie authentication now serves admin, warehouse and customer
roles. Customer checkout/payment adapt the same verified `current_user` identity
through `require_customer`; missing sessions return 401 and wrong roles return
403 before customer data is queried. SQL migration files are included for team
review; no live database migration or real payment was run when integrating this branch.

## Upload ảnh sản phẩm vào Supabase Storage

- API: `POST /api/admin/media/images` (ADMIN, cookie/Bearer hợp lệ và `Origin`
  nằm trong `FRONTEND_ORIGINS`). Body là bytes của file với Content-Type
  `image/jpeg`, `image/png` hoặc `image/webp`, không phải JSON/multipart.
- Giới hạn đầu vào 5 MiB, ảnh tĩnh tối đa 4096 × 4096 pixel. Pillow kiểm tra và
  giải mã nội dung thật, từ chối file giả/hỏng hoặc MIME không khớp, xử lý hướng
  EXIF rồi chuẩn hóa WebP và bỏ metadata. File đầu ra cũng giới hạn 5 MiB.
- File ghi vào `media/products/<uuid>.webp`, không ghi đè file cũ. Response 201
  chứa `bucket`, `path`, `url`, `content_type`, `size`, `width`, `height`.
  UI dùng `url` để POST/PATCH `duong_dan_anh` ở API sản phẩm.

Thiết lập trước khi dùng thật:

1. Cài requirements backend mới (có Pillow); deploy backend trước hoặc cùng Admin.
2. Trong Supabase Dashboard → Storage, kiểm tra bucket `media` dùng cho ảnh
   sản phẩm công khai. Đặt `SUPABASE_MEDIA_BUCKET=media` (mặc định cũng là `media`).
   Bucket cần public để URL ảnh không hết hạn; nếu chỉ cho phép một số MIME,
   danh sách phải có `image/webp`. Giới hạn bucket phải đủ cho ảnh đầu ra, tối đa 5 MiB.
3. Không chuyển public một bucket đang chứa tài liệu riêng tư; chọn bucket mới
   phù hợp và cấu hình lại biến môi trường. API chỉ kiểm tra, không tạo/sửa quyền bucket.
4. `SUPABASE_URL` và secret có quyền Storage chỉ nằm ở backend. Không cấp quyền
   ghi public/anonymous cho bucket. Next gateway chuyển bytes và cookie, không có key Supabase.
5. Test với tài khoản admin và một sản phẩm test trên staging: chọn ảnh, lưu,
   tải lại bản ghi và mở URL ảnh; kiểm tra lỗi quyền và dung lượng. Không dùng test
   tự động để ghi dữ liệu production.

Upload và ghi sản phẩm là hai thao tác độc lập. Nếu ghi sản phẩm lỗi, UI giữ URL
đã upload để thử lại, không upload lại tự động. Hủy trước khi lưu không upload.
Gỡ/thay ảnh chỉ đổi URL ở sản phẩm; không xóa file Storage cũ vì có thể còn nơi
khác sử dụng. File upload thành công nhưng chưa được gắn vào sản phẩm có thể
cần dọn theo quy trình lưu trữ riêng; chưa có tác vụ tự động dọn/xóa trong đợt này.

Tham khảo: [Supabase Upload](https://supabase.com/docs/reference/python/storage-from-upload),
[public/private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
Kiểm thử offline: `python -m pytest tests/test_media.py -q` từ thư mục Backend.
# Vận hành admin

Nhân viên kho đã có luồng phiếu nhập riêng, giới hạn theo kho được phân công:
[API, migration và kiểm thử nhập hàng](docs/WAREHOUSE_OPERATIONS.md).

Luồng đơn hàng, phiếu nhập/chuyển kho, kiểm kê, hóa đơn và ghi nhận thu/hoàn tiền
được bổ sung qua API transaction riêng. Xem [hợp đồng, migration và cách kiểm thử](docs/ADMIN_OPERATIONS.md).
Các mô tả “chỉ đọc” bên dưới áp dụng cho CRUD bảng; không thay thế API vận hành mới.

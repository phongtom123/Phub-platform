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
FRONTEND_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8000,http://127.0.0.1:8000
COOKIE_SECURE=false
```

Lấy Project URL từ Supabase Dashboard → Project Settings → API/Data API. Tạo khóa bí mật mới trong API Keys.
Khóa từng gửi qua chat phải được thu hồi/thay mới; không đặt khóa vào biến `NEXT_PUBLIC_*`.
Sinh JWT secret bằng lệnh sau, rồi lưu giá trị vào `.env`, không gửi qua chat:

```powershell
.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI: http://localhost:8000/openapi.json
- Liveness: http://127.0.0.1:8000/api/health (không kiểm tra DB).
- Test: `.venv\Scripts\python.exe -m pytest tests -q`.

Swagger có 47 thao tác, schema/ví dụ riêng cho từng bảng, role và mã lỗi. Xem [hướng dẫn Swagger/OpenAPI](docs/README.md) để đăng nhập thử bằng cookie và cập nhật snapshot [docs/openapi.json](docs/openapi.json). Trang docs không cần Supabase để mở; thử API dữ liệu cần cấu hình thật. `.env` cũ cần thêm origin cổng 8000 nếu muốn thử POST/PATCH trực tiếp từ Swagger.

## Chuẩn bị database

Nguồn chuẩn là [schema.dbml](../database/schema.dbml), gồm 19 bảng, SKU, loại sản phẩm và tổng tiền giảm trên hóa đơn, không có bảng chi nhánh.

Nếu Supabase **chưa có bảng/dữ liệu**, kiểm tra rồi chạy [001_initial_schema.sql](../database/migrations/001_initial_schema.sql) trong SQL Editor. Script có transaction, 32 khóa ngoại, check constraints, RLS và chặn truy cập bảng trực tiếp từ vai trò `anon`/`authenticated`.

Nếu database **đã tồn tại**, không chạy migration tạo mới và không xóa bảng để chạy lại. So sánh tên bảng/cột/khóa ngoại với DBML trước; cần migration nâng cấp riêng. Các bảng dùng tên viết hoa có dấu nháy kép, ví dụ `public."SAN_PHAM"`. Quan hệ FK cần tồn tại để PostgREST lọc theo khách hàng/kho qua các bảng chi tiết.

Vì Python dùng khóa đặc quyền bỏ qua RLS, toàn bộ quyền truy cập được kiểm tra tại API. Database đang có dữ liệu cũng phải bật RLS/chặn API bảng công khai; không dùng UI-only guards thay cho phân quyền. Không chạy script seed cũ mặc định: script đó có dữ liệu điện thoại/laptop và ghi vào DB, không phù hợp danh mục PC hiện tại.

### Tài khoản đầu tiên

Không có tài khoản/password demo hardcode. Tạo bản ghi `NHAN_VIEN` qua Supabase Table Editor (`loai_nhan_vien=ADMIN`, `ma_kho=NULL`, `trang_thai=1`). Chạy:

```powershell
.venv\Scripts\python.exe scripts/hash_password.py
```

Nhập mật khẩu hai lần ở terminal (không hiển thị). Lưu chuỗi hash trả về vào `TAI_KHOAN.mat_khau_hash`, gán `ma_nhan_vien` đúng nhân viên, `ma_kh=NULL`, trạng thái 1 và tên tài khoản duy nhất. Từ đó admin có thể tạo nhân viên/khách/tài khoản bằng UI. Tài khoản khách phải liên kết một `KHACH_HANG`; thủ kho phải có `ma_kho` và role `THU_KHO`.

## API đã có

### Xác thực

| Endpoint | Mục đích |
| --- | --- |
| `POST /api/auth/login` | `{ "username": "...", "password": "..." }`, username hoặc email |
| `GET /api/auth/me` | Tài khoản/role/kho đang đăng nhập |
| `POST /api/auth/logout` | Xóa cookie phiên ở trình duyệt |

Cookie `phub_session`: HttpOnly, SameSite=Lax, 8 giờ. Token không trả trong JSON và không lưu localStorage. Mỗi request đọc lại role/trạng thái DB; thay mật khẩu làm vô hiệu token cũ. Mật khẩu mới hash Argon2; có thể đọc hash bcrypt cũ. Không có refresh token, đăng ký tự phục vụ, reset password hoặc thu hồi từng token bị đánh cắp trong đợt này. Đăng xuất xóa cookie, không phải server-side blacklist.

Request ghi phải có `Origin` nằm trong `FRONTEND_ORIGINS` (Swagger/Python CLI khi thử cần gửi header này). Login giới hạn 20 lần/IP/phút trong **một process**. Triển khai nhiều worker cần shared limiter, HTTPS và `COOKIE_SECURE=true`. Ba cổng localhost dùng chung cookie trên cùng host; không trộn `localhost` với `127.0.0.1` cho URL của ba UI.

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
| accounts | TAI_KHOAN | ADMIN |
| customers | KHACH_HANG | ADMIN |
| categories | LOAI_SP | ADMIN |
| products | SAN_PHAM | ADMIN |
| inventory | TON_KHO | Chỉ đọc |
| suppliers | NHA_CUNG_CAP | ADMIN, THU_KHO |
| receipts / receipt-lines | PHIEU_NHAP / CT_PHIEU_NHAP | Chỉ đọc |
| transfers / transfer-lines | PHIEU_CHUYEN_KHO / CT_CHUYEN_KHO | Chỉ đọc |
| orders / order-lines | DON_HANG / CT_DON_HANG | Chỉ đọc |
| invoices / payments | HOA_DON / THANH_TOAN | Chỉ đọc |
| promotions / vouchers | CHUONG_TRINH_KHUYEN_MAI / VOUCHER | ADMIN |
| voucher-uses | SU_DUNG_VOUCHER | Chỉ đọc |

ADMIN xem 19 bảng. THU_KHO chỉ xem danh mục/sản phẩm/nhà cung cấp và kho, tồn, phiếu thuộc kho được gán. Khách chỉ xem thông tin/đơn/chi tiết đơn/hóa đơn/thanh toán/lượt voucher của mình. Bản ghi ngoài phạm vi không trả về dù truyền PK hợp lệ.

Account payload dùng `password`, không nhận/trả `mat_khau_hash`. Các API không trả password/hash. Money trả dạng chuỗi decimal, không dùng float JavaScript để tính tổng. Người/ngày tạo khuyến mãi và ngày tạo voucher do backend gán. Chuẩn hóa code voucher uppercase. Ảnh sản phẩm sửa bằng `duong_dan_anh` (URL); upload file chưa có API. Schema chương trình khuyến mãi **không có cột ảnh**, nên chưa lưu ảnh chương trình vào DB.

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

```text
app/
  main.py        # CORS, routers, health, compatibility endpoint
  config.py      # Server environment configuration
  supabase.py    # Lazy client, injectable trong tests
  auth.py        # Hash, session cookie, current user, role
  resources.py   # Allowlist 19 bảng và model từ DBML
  tables.py      # Scope dữ liệu, đọc + CRUD dữ liệu nền
  errors.py      # Lỗi an toàn, không trả chi tiết DB/secret
  catalog/       # Catalog công khai có sẵn
scripts/hash_password.py
tests/           # Offline HTTP/PostgREST mocks, không cần khóa thật
```

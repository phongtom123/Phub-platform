# PHUB Platform — PC và linh kiện

Ba UI Next.js, một backend FastAPI Python và Supabase PostgreSQL. Chạy local bằng npm/venv/uvicorn, không cần container.

```text
Browser → Next.js /api/backend/* → FastAPI :8000 → Supabase
```

## Cấu trúc mã

```text
Phub-platform/
├── database/
│   ├── schema.dbml                  # 19 bảng, không có chi nhánh
│   └── migrations/001_initial_schema.sql
├── Backend/
│   ├── app/
│   │   ├── main.py                  # App, CORS, health, routers
│   │   ├── config.py / supabase.py   # Cấu hình server và client database
│   │   ├── auth.py                  # Đăng nhập/cookie, role, scope
│   │   ├── resources.py             # Allowlist bảng và validation models
│   │   ├── tables.py                # Table APIs
│   │   ├── errors.py                # Phản hồi lỗi an toàn
│   │   └── catalog/                 # Catalog công khai
│   ├── scripts/hash_password.py     # Tạo hash tài khoản đầu tiên
│   ├── tests/
│   ├── .env.example
│   └── README.md                    # API, quyền, hướng dẫn database
└── ui/
    ├── adminUI/                     # Next.js 15 · :3000
    │   ├── app/api/backend/[...path]/route.ts
    │   ├── app/data/[resource]/page.tsx
    │   └── src/components/backend-data-view.tsx
    ├── warehouseUI/                 # Next.js 15 · :3002
    │   ├── app/ / src/
    │   └── src/components/backend-data-view.tsx
    ├── userUI/Frontend/             # Next.js 16 · :3001
    │   └── src/app/                 # Catalog, auth, profile, data
    └── shared/
        ├── backend-route.ts         # Gateway server dùng chung
        ├── record-navigation.ts     # Chuyển URL chi tiết cũ
        └── data-manager.css         # Kiểu trình bày dữ liệu dùng chung
```

Các UI giữ dependencies riêng để tránh xung đột Next.js/React. Không chạy `npm install` tại root.

## Chuẩn bị

- Node.js 20.9+ (khuyến nghị Node.js 22), npm, Python 3.11+.
- Supabase Project URL và một **secret key mới chỉ dùng phía server**.
- Tạo `Backend/.env` theo [mẫu](Backend/.env.example); cấu hình JWT secret ngẫu nhiên ít nhất 32 ký tự.
- Khóa đã gửi qua chat phải thu hồi/thay mới. Không lưu secret vào Git, UI hoặc `NEXT_PUBLIC_*`.
- Làm theo [hướng dẫn database và tài khoản đầu tiên](Backend/README.md). Migration tạo mới chỉ dùng cho database trống; chưa chạy migration/seed lên Supabase tự động.

Mỗi UI có `.env.example`; có thể tạo `.env.local` tương ứng. Gateway mặc định dùng `PHUB_API_BASE_URL=http://127.0.0.1:8000`. Không cần Supabase key trong UI.

## Chạy bốn terminal

Các lệnh dưới đây bắt đầu từ thư mục repository. Dùng `npm.cmd` trên PowerShell nếu `npm.ps1` bị chặn.

**Terminal 1 — Python API**

```powershell
cd Backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Admin**

```powershell
cd ui/adminUI
npm.cmd install
npm.cmd run dev
```

**Terminal 3 — Khách hàng**

```powershell
cd ui/userUI/Frontend
npm.cmd install
npm.cmd run dev -- -p 3001
```

**Terminal 4 — Kho**

```powershell
cd ui/warehouseUI
npm.cmd install
npm.cmd run dev
```

| Ứng dụng | URL |
| --- | --- |
| Admin / đăng nhập nhân sự | http://localhost:3000 |
| Khách hàng | http://localhost:3001/auth/login |
| Nhân viên kho | http://localhost:3002 |
| API / Swagger | http://localhost:8000/docs |

Ba UI dùng cùng hostname `localhost` để chia sẻ cookie đăng nhập. Tài khoản ADMIN vào admin, THU_KHO vào kho, KHACH_HANG vào storefront, kể cả khi đăng nhập nhầm cổng. Role do database quyết định, không lấy từ query string/localStorage. Không còn tài khoản demo `password123`.

## Những phần đã nối backend

- Đăng nhập, phiên cookie HttpOnly, kiểm tra role/trạng thái/kho và đăng xuất.
- API đọc/phân trang/tìm kiếm cho 19 bảng, kiểm tra scope theo role.
- Tạo/sửa 9 bảng dữ liệu nền: kho, nhân viên, tài khoản, khách hàng, loại sản phẩm, sản phẩm, nhà cung cấp, chương trình khuyến mãi, voucher.
- Danh sách/chi tiết/form dữ liệu thật trên admin và kho, route riêng `/data/{resource}`; URL chi tiết cũ chuyển sang route này.
- Dashboard không còn dùng các số liệu doanh thu/tồn kho giả; số liệu danh sách lấy qua API.
- Catalog/chi tiết sản phẩm khách hàng giữ kết nối API có sẵn; đăng nhập và hồ sơ/đơn/hóa đơn/thanh toán của khách đã dùng API theo tài khoản.
- Sản phẩm sửa ảnh bằng URL `duong_dan_anh`. Upload file và ảnh chương trình chưa có schema/API.

Không dùng mock để che lỗi Supabase: API/UI hiển thị lỗi cấu hình/kết nối. Các trang cài đặt, thông báo và một số màn hình storefront vẫn là UI mẫu; không coi thao tác trên đó là đã ghi database.

## Giới hạn hiện tại

Đây là đợt triển khai nền API và CRUD, **chưa hoàn thành toàn bộ backend nghiệp vụ**. Phiếu nhập/chuyển kho/đơn/chi tiết đơn/tồn/hóa đơn/thanh toán/lượt voucher mới có API đọc. Các thao tác ghi liên quan cần PostgreSQL transaction/RPC và kiểm thử đồng thời: chưa có checkout thật, xác nhận nhập/xuất/nhận kho, chốt hóa đơn, áp voucher, webhook/hoàn tiền. Không mở CRUD trực tiếp cho tồn/tiền và không có DELETE.

Đăng ký tự phục vụ, reset password, refresh token và thu hồi token phía server chưa có. Hiện dùng một phiên chung trên ba cổng localhost. Đây là cấu hình phát triển local, không phải cấu hình production.

Chi tiết endpoint, payload, quyền và backlog: [Backend/README.md](Backend/README.md).

Quản lý đặc tả, đăng nhập trong Swagger và xuất OpenAPI: [Backend/docs/README.md](Backend/docs/README.md). Snapshot 47 thao tác: [Backend/docs/openapi.json](Backend/docs/openapi.json).

## Kiểm tra mã

```powershell
cd Backend
.venv\Scripts\python.exe -m pytest tests -q
```

Trong từng thư mục UI chạy `npm.cmd run build`; có thể kiểm tra TypeScript bằng `node node_modules/typescript/bin/tsc --noEmit`. Tests backend dùng HTTP/PostgREST mocks, không cần secret thật, không tự chứng minh migration/live Supabase hoạt động.

Kiểm tra gateway dùng chung từ root: `node --test ui/shared/tests/backend-route.test.cjs` (cần dependencies admin đã cài).

Không commit `node_modules`, `.next`, `.venv`, `.env`, `.env.local` hoặc thông tin khách hàng thật. Chưa commit/push thay đổi triển khai này tự động.

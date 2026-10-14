# Triển khai PHUB trên Render

Danh mục hiện là danh sách phẳng. Backend không truy vấn `ma_loai_cha` và không
cần migration cha–con. Các danh mục/sản phẩm đang có vẫn được giữ. Migration
`20261013155334_category_hierarchy.sql` chỉ lưu lịch sử; không chạy migration đó
cho bản danh mục phẳng. Nếu database đã có cột cha, có thể để nguyên cột chưa dùng.

## Cập nhật hai service hiện có

Trong **Settings → Build & Deploy**, dùng các giá trị dưới đây. Root Directory
để trống (gốc repository), hoặc `.`. Không đặt `Backend` hay `ui/userUI/Frontend`:
API cần `database/schema.dbml`, còn frontend cần `ui/shared` bên ngoài thư mục app.

| Cài đặt | API `phub-api` | Website `phub-platform` |
| --- | --- | --- |
| Repository | `phongtom123/Phub-platform` | `phongtom123/Phub-platform` |
| Branch | `main` | `main` |
| Root Directory | trống hoặc `.` | trống hoặc `.` |
| Auto-Deploy | On Commit | On Commit |
| Health Check Path | `/api/health` | `/` |

API Build Command:

```sh
pip install -r Backend/requirements.txt -c Backend/constraints-render.txt && python Backend/scripts/export_openapi.py --check
```

API Start Command:

```sh
cd Backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Website Build Command:

```sh
npm --prefix ui/userUI/Frontend ci && npm --prefix ui/userUI/Frontend run build
```

Website Start Command:

```sh
npm --prefix ui/userUI/Frontend run start -- --hostname 0.0.0.0 --port $PORT
```

Script `build` của website dùng `next build --webpack`. Bản Turbopack hiện tại
đã báo `Cannot find module '@vercel/turbopack/postcss'` khi build CSS trên Render;
Webpack xử lý PostCSS/CSS Modules qua pipeline production khác. Giữ lệnh
`npm ... run build` để áp dụng lựa chọn này; không thay bằng `next build` trực tiếp.
Khi deploy bản sửa lần đầu, chọn **Clear build cache & deploy** để bỏ artifacts
Turbopack cũ. Không cần cài thêm package `@vercel/turbopack/postcss`.

Build Filters (Included Paths, tính từ gốc repository):

- API: `Backend/**`, `database/schema.dbml`.
- Website: `ui/userUI/Frontend/**`, `ui/shared/**`.

## Environment

Website: `NODE_VERSION=22`, `PHUB_API_BASE_URL=https://phub-api.onrender.com`.
Nếu admin/kho cũng chạy trên cloud, đặt `NEXT_PUBLIC_ADMIN_URL` và
`NEXT_PUBLIC_WAREHOUSE_URL` thành URL thực tế của hai UI đó, trước khi build.

API: giữ `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET` hiện có;
đặt `COOKIE_SECURE=true`; `FRONTEND_ORIGINS` phải chứa
`https://phub-platform.onrender.com` và các origin admin/kho thực tế.
Không đưa khóa Supabase hoặc JWT vào frontend.

`render.yaml` chứa cùng cấu hình, với các secret dùng `sync: false`. Chỉ thêm
file này vào Git không tự thay đổi service tạo thủ công: cần liên kết/sync
Blueprint, hoặc cập nhật các ô trong Dashboard như trên. Giữ nguyên plan/region
của các service hiện có khi áp dụng cấu hình.

## Kiểm tra sau deploy

Push bản sửa lên `main`, rồi **Manual Deploy → Deploy latest commit** cho API
và website. Đối chiếu commit đang Live với commit vừa push.

- `GET https://phub-api.onrender.com/api/health`: HTTP 200.
- `GET https://phub-api.onrender.com/api/catalog/categories`: HTTP 200,
  `{items:[{id,name}]}` hoặc danh sách rỗng nếu chưa có loại đang hoạt động.
- `GET https://phub-platform.onrender.com/api/catalog/categories`: HTTP 200,
  cùng dữ liệu danh mục từ API.
- `/` có tiêu đề `PHUB Store | PC nguyên bộ và linh kiện`.
- Desktop/mobile hiển thị mọi loại đang hoạt động ở cùng một cấp. Bấm một loại
  mở `/main/product?category_id=...`; danh sách chỉ lọc các mã loại đã chọn.

Nếu API vẫn trả 500, xem lỗi truy vấn Supabase trong log deploy/runtime; health
200 chỉ xác nhận tiến trình chạy, không xác nhận database hoặc đăng nhập.

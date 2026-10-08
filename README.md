# PHUB Platform – Integrated UI

Repository tổng hợp giao diện từ các nhánh `adminUI`, `userUI` và `warehouseUI`.

**Frontend khách hàng đang sử dụng: `ui/userUI/Frontend/`.** Bản chính trước đây ở ngoài `ui` đã được chuyển vào đây, giữ nguyên giao diện, dữ liệu và các trang đã bổ sung. Xem [ghi chú gộp](ui/userUI/Frontend/MERGE-NOTES.md).

**Thử đầy đủ UI đặt đơn/hóa đơn/thanh toán, chưa ghi Supabase:**
xem [PAYMENT-UI-REVIEW.md](PAYMENT-UI-REVIEW.md). Luồng thực thi dùng fixture riêng;
đơn/hóa đơn/thanh toán có sẵn trên Supabase vẫn đọc được.

Mỗi giao diện được giữ trong một thư mục riêng để tránh xung đột giữa các phiên bản Next.js, dependency và cấu trúc source code. Không chạy `npm install` tại thư mục root; hãy mở terminal tại đúng ứng dụng cần chạy.

## Cấu trúc tổng hợp

```text
Phub-platform/
├── Backend/                     # FastAPI và kết nối Supabase dùng chung
├── ui/
│   ├── adminUI/                  # Giao diện quản trị viên
│   │   ├── app/
│   │   ├── src/
│   │   └── package.json
│   ├── userUI/                   # Nội dung nhánh userUI
│   │   └── Frontend/             # Giao diện khách hàng đã gộp, bản chính
│   └── warehouseUI/              # Giao diện thủ kho
│       ├── app/
│       ├── src/
│       └── package.json
├── .gitignore
└── README.md
```

## Nguồn mã đã tổng hợp

| Thư mục | Nhánh nguồn | Commit nguồn |
| --- | --- | --- |
| `ui/adminUI` | `origin/adminUI` | `975a497` |
| `ui/userUI` | `origin/userUI` | `add4fa4` |
| `ui/warehouseUI` | `origin/warehouseUI` | `76273a4` |

Nhánh `main` tại thời điểm tổng hợp chỉ chứa README và không có ứng dụng riêng, vì vậy không tạo thêm `ui/main`.

Nhánh `userUI` gốc có nhiều route rỗng. Trên nhánh tổng hợp, giao diện khách hàng đã được bổ sung trang đăng nhập, storefront, danh mục có bộ lọc theo nhóm và trang chi tiết sản phẩm tĩnh. Thư mục type sinh tự động cũ đã được loại bỏ; Next.js sẽ tạo lại route types trong `.next/types`.

## Yêu cầu môi trường

- Node.js 20 trở lên.
- npm 10 trở lên.
- Python 3.11 trở lên nếu chạy Backend mẫu của `userUI`.

## Chạy giao diện quản trị viên

```bash
cd ui/adminUI
npm install
npm run dev
```

Trang đăng nhập quản trị viên: `http://localhost:3000`.

Đây cũng là cổng đăng nhập chung cho nhân sự nội bộ. Giao diện sẽ điều hướng theo vai trò của tài khoản mẫu:

- `admin.thinh / password123` → giao diện quản trị viên tại cổng `3000`.
- `phong.kho / password123` → giao diện nhân viên kho tại cổng `3002`.

## Chạy giao diện khách hàng

```bash
cd ui/userUI/Frontend
npm install
npm run dev
```

Trang đăng nhập khách hàng (UI mẫu, chưa xác thực): `http://localhost:3000/auth/login`.

- Trang chủ mua sắm: `http://localhost:3000/` (alias: `/main/landing`).
- Danh mục sản phẩm: `http://localhost:3000/main/product`.
- Catalog List View: `http://localhost:3000/main/product?view=list`.
- Chi tiết sản phẩm: `http://localhost:3000/main/product/ps-001`.

Nếu chạy cùng admin ở cổng 3000, dùng `npm run dev -- -p 3001` trong `ui/userUI/Frontend` để tránh trùng cổng. Đăng nhập khách hàng hiện chỉ là thao tác chuyển trang demo, không tạo phiên xác thực.

## Chạy giao diện thủ kho

```bash
cd ui/warehouseUI
npm install
npm run dev
```

Truy cập `http://localhost:3002`.

## Chạy Backend

```bash
cd Backend
python -m venv .venv
```

Kích hoạt môi trường ảo trên PowerShell:

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
fastapi dev
```

### Cấu hình Supabase và file `.env`

Backend đọc thông tin kết nối Supabase từ `Backend/.env`. File này nằm trong
`.gitignore`, vì vậy không được commit URL hoặc secret key thật lên Git.

Ở lần khởi động đầu tiên, nếu chưa có `.env`, backend sẽ tự sao chép
`Backend/.env.example` thành `Backend/.env`. Lần chạy đầu có thể dừng lại và yêu
cầu cấu hình vì file mới vẫn chứa các giá trị mẫu.

Mở `Backend/.env` và thay các giá trị sau bằng thông tin của project Supabase:

```dotenv
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxx
```

- `SUPABASE_URL`: URL của project Supabase.
- `SUPABASE_SECRET_KEY`: secret key chỉ dùng trong backend; không đưa biến này
  sang frontend và không đặt tiền tố `NEXT_PUBLIC_`.
- `FRONTEND_URL`: địa chỉ frontend mẫu; cấu hình CORS hiện nằm trong
  `Backend/app/main.py`.

Sau khi điền giá trị thật, khởi động lại backend:

```powershell
cd Backend
.venv\Scripts\Activate.ps1
fastapi dev
```

Nếu muốn tạo file trước khi chạy ứng dụng, có thể sao chép thủ công:

```powershell
Copy-Item .env.example .env
```

Backend không ghi đè `.env` đã tồn tại. Khi cần thêm biến môi trường mới, hãy
cập nhật cả `.env.example` bằng giá trị mẫu an toàn để các thành viên khác biết
cần cấu hình biến nào.

## Nguyên tắc phát triển

- Mỗi nhóm làm việc trong đúng thư mục UI của mình.
- Không đưa `node_modules`, `.next`, file `.env` hoặc môi trường Python `.venv` lên Git.
- Khi cần dùng chung API hoặc kiểu dữ liệu, nên tạo package dùng chung riêng thay vì import chéo trực tiếp giữa ba ứng dụng.
- Các nhánh gốc vẫn được giữ nguyên; nhánh tổng hợp chỉ tổ chức lại source code theo thư mục.
# PHUB Platform

Phần khách hàng đang phát triển trên nhánh `ui-review`.

- [Chạy giao diện và test từng chức năng](CUSTOMER-TESTING.md)
- [Test trên Supabase thật với khách đầu tiên được cho phép](CUSTOMER-SUPABASE-TESTING.md)
- [Cài đặt và cấu hình Render để tự triển khai sau](CUSTOMER-DEPLOYMENT.md)
- [Backend/API và bốn mục tiêu khách hàng](Backend/README.md)
- [Tích hợp UI desktop/mobile và E2E](ui/userUI/Frontend/SHOPPING-INTEGRATION.md)

Đăng nhập thật do thành viên khác phụ trách. Các migration mua hàng được chuẩn bị
riêng và chưa tự áp dụng lên Supabase chung.

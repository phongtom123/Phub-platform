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

## Khởi động hệ thống Khách hàng (Sản phẩm, Giỏ hàng, Checkout) trên PowerShell

Hệ thống mua sắm khách hàng (`ui/userUI/Frontend` + `Backend`) bao gồm: danh mục sản phẩm, tìm kiếm, bộ lọc, chi tiết sản phẩm, thêm vào giỏ hàng, giỏ hàng, thông tin nhận hàng và xác nhận đơn hàng.

> [!IMPORTANT]
> **Lưu ý về lỗi "Chức năng mua hàng hiện chưa sẵn sàng":**
> Nếu chạy Backend ở chế độ `Real` (`app.main:app`), API xác thực khách hàng đang tạm khóa bằng mã lỗi `503 AUTH_INTEGRATION_REQUIRED` (chờ module đăng nhập của nhóm gộp vào). Do đó, khi thêm vào giỏ hàng sẽ bị báo chưa sẵn sàng.
> **Để sử dụng và kiểm thử đầy đủ giỏ hàng:** hãy khởi động theo **Cách 1 (Script tự động với Mode SupabaseTest)** hoặc **Cách 2 (Mở 2 Terminal PowerShell thủ công)** dưới đây.

---

### Cách 1: Khởi động tự động bằng Script PowerShell (Khuyên dùng)

Mở **PowerShell** tại thư mục gốc của dự án (`Phub-platform`):

#### 1. Chế độ `SupabaseTest` (Dữ liệu Supabase thật)
Kết nối trực tiếp Supabase lấy danh sách sản phẩm thật, tự động dùng phiên khách hàng test đầu tiên để không bị vướng bước đăng nhập:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode SupabaseTest
```
- **Giao diện mua hàng:** [http://127.0.0.1:3001/main/product](http://127.0.0.1:3001/main/product)
- **Tài liệu API Swagger:** [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)
- *Chức năng test được:* Xem danh sách, tìm kiếm, lọc (danh mục, hãng, giá, màu sắc), xem chi tiết, **thêm vào giỏ hàng**, chỉnh sửa số lượng giỏ, tính tổng tiền, điền và bấm **"Lưu"** thông tin nhận hàng trực tiếp vào Supabase.

#### 2. Chế độ `Demo` (Mock RAM độc lập - Toàn bộ luồng đặt hàng & thanh toán)
Chạy server fixture độc lập trong RAM, cho phép test đặt đơn và mô phỏng thanh toán mà không làm ảnh hưởng Supabase:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Demo
```
- **Giao diện mua hàng:** [http://127.0.0.1:13001/main/product](http://127.0.0.1:13001/main/product)
- **Trang điều khiển khách mẫu & thanh toán:** [http://127.0.0.1:18001/__manual](http://127.0.0.1:18001/__manual)
- *Chức năng test được:* Thêm sản phẩm SKU-A vào giỏ, áp mã voucher `SAVE10`, bấm **"Đặt đơn"** thành công, và thử các kịch bản thanh toán (Chờ xử lý / Đã thanh toán / Hoàn tiền).

#### 3. Dừng server
Khi muốn dừng hệ thống, chạy:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode SupabaseTest
# hoặc nếu đang chạy Demo:
powershell -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Demo
```

---

### Cách 2: Khởi động thủ công bằng 2 Terminal PowerShell (Xem log trực tiếp)

Mở 2 cửa sổ PowerShell riêng biệt từ thư mục gốc của dự án:

#### Terminal 1: Chạy Backend (cổng 8001)
```powershell
cd Backend
$env:PHUB_SUPABASE_TEST_MODE = 'local-only'
$env:PHUB_SUPABASE_TEST_AUTO_CUSTOMER = '1'
$env:PHUB_SUPABASE_TEST_UI_ORIGIN = 'http://127.0.0.1:3001'
.\.venv\Scripts\python.exe -m uvicorn scripts.supabase_shopping_test:app --host 127.0.0.1 --port 8001
```

#### Terminal 2: Chạy Frontend (cổng 3001)
```powershell
cd ui/userUI/Frontend
$env:PHUB_API_BASE_URL = 'http://127.0.0.1:8001'
$env:PHUB_UI_ORIGIN = 'http://127.0.0.1:3001'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:NEXT_TEST_WASM_DIR = (Resolve-Path 'node_modules/@next/swc-wasm-nodejs').Path
npm.cmd run dev -- --webpack --hostname 127.0.0.1 --port 3001
```

---

### Các đường dẫn trang chức năng (Cổng 3001)

| Trang chức năng | Đường dẫn (URL) |
| :--- | :--- |
| **Danh mục sản phẩm (Tìm kiếm, lọc, phân trang)** | [http://127.0.0.1:3001/main/product](http://127.0.0.1:3001/main/product) |
| **Chi tiết sản phẩm** | [http://127.0.0.1:3001/main/product/SEED_SP001](http://127.0.0.1:3001/main/product/SEED_SP001) *(hoặc click từ danh mục)* |
| **Giỏ hàng (Chọn món, sửa số lượng, tính tổng)** | [http://127.0.0.1:3001/cart](http://127.0.0.1:3001/cart) |
| **Thông tin người nhận hàng (Checkout form)** | [http://127.0.0.1:3001/checkout](http://127.0.0.1:3001/checkout) |
| **Xác nhận đơn hàng** | [http://127.0.0.1:3001/checkout/confirm](http://127.0.0.1:3001/checkout/confirm) |
| **Hồ sơ cá nhân & Lịch sử đơn hàng** | [http://127.0.0.1:3001/main/profile](http://127.0.0.1:3001/main/profile) |
| **Swagger API docs** | [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs) |

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

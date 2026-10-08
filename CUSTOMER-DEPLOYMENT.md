# Giao diện khách hàng — chạy thử và deploy Render

Code nằm trên nhánh **ui-review**. Bốn module catalog/đặt đơn/thanh toán/mua hàng
và UI desktop/mobile giữ nguyên cấu trúc. Không thay UI admin, kho, đăng ký hoặc
đăng nhập. Không tự chạy migration khi startup/build/deploy.

## Hiện có thể test gì?

| Chế độ | Dữ liệu | Chức năng |
| --- | --- | --- |
| SupabaseTest local | Supabase thật, phiên khách cố định đầu tiên theo quyền đã cấp | Catalog/hồ sơ/giỏ; checkout/voucher/đơn cần RPC đã chuẩn bị. Không dùng mode này trên Render |
| Demo local | Database và phiên khách giả lập trong RAM | Catalog → giỏ → voucher → checkout → đơn → thanh toán; test quyền khách A/B |
| Real local hoặc Render | Supabase cấu hình trong Backend | Catalog thật; các API khách chờ dependency xác thực của thành viên đăng nhập |

**Phần còn chờ nhóm:** nối `app/payments/auth.py::require_customer` với danh tính
đã xác minh; review và áp hai migration vào database thử trước khi dùng chung.
API khách hiện trả `503 AUTH_INTEGRATION_REQUIRED`, không tin mã khách tự gửi.
Triển khai được hai tiến trình không có nghĩa toàn luồng đặt đơn thật đã hoạt động.
Demo không kiểm tra mật khẩu, không chứng nhận Supabase hoặc luồng xuất kho.

Chạy phiên khách test với database thật theo
[CUSTOMER-SUPABASE-TESTING.md](CUSTOMER-SUPABASE-TESTING.md).

## Cài đặt một lần trên Windows

Từ thư mục gốc, dùng Python 3.14 và Node 24. Các bản đã kiểm tra tại máy này:
Python 3.14.6, Node 24.21.0.

```powershell
# Chỉ chạy tạo venv nếu chưa có Backend/.venv
py -3.14 -m venv Backend/.venv
& Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements-test.txt
npm.cmd --prefix ui/userUI/Frontend ci --include=dev
```

Nếu Windows chặn SWC native, cài bản WASM cùng phiên bản Next:

```powershell
npm.cmd --prefix ui/userUI/Frontend install --no-save --package-lock=false --ignore-scripts @next/swc-wasm-nodejs@16.3.6
```

Không cần Supabase cho Demo. Real cần `Backend/.env` theo `.env.example`; khóa chỉ
ở Backend, không đưa vào frontend hoặc Git. Script không sửa file `.env` sẵn có.

## Test ngay trên giao diện khi chưa nối đăng nhập

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Demo
```

Mở **http://127.0.0.1:18001/__manual**, chọn khách A. UI chạy ở
http://127.0.0.1:13001/main/product, Swagger ở http://127.0.0.1:18001/docs.

1. Mở chi tiết sản phẩm SKU-A và thêm giỏ. Tồn mẫu 5 chiếc, giá 100.000,10 ₫.
2. Sửa số lượng, dùng voucher `SAVE10` giảm 10%; thử thêm mã sai hoặc số lượng quá tồn.
3. Checkout: nhập người nhận/địa chỉ, xác nhận giá rồi đặt. Đơn mới chưa có thanh toán.
4. Trở lại trang `/__manual`, chọn giao dịch chờ/thành công/hoàn tiền cho đơn mới
   nhất của khách A; vào chi tiết đơn, bấm cập nhật để xem trạng thái/lịch sử.
5. Chọn khách B rồi mở URL đơn A: không được xem. Chọn xem chưa đăng nhập để
   kiểm tra catalog công khai và việc chặn mua hàng.
6. Dùng DevTools kích thước mobile để thử cùng giỏ/checkout/đơn; reset dữ liệu
   từ trang điều khiển để bắt đầu lại. Reset không xóa giỏ trình duyệt.

Demo dùng routers/repositories API thật với MockTransport, không kết nối Supabase.
Ảnh mẫu là placeholder. Đơn và thanh toán mẫu mất khi khởi động lại backend.
Không đưa `PHUB_E2E_MODE`, key hoặc app fixture vào cấu hình Render.

Script chạy nền từ **mã nguồn hiện tại**, không tạo bản sao hoặc đổi nhánh.
Dev mode cập nhật UI khi sửa file. Log/PID ở `.customer-runtime` (đã ignore).
Dừng trước khi chuyển chế độ hoặc build:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Demo
```

Real local dùng `-Mode Real`, UI cổng 3001 và API cổng 8001. Chỉ chạy một Next dev
server trên thư mục UI tại một thời điểm. Để test production build, build trước
rồi thêm `-Production` vào lệnh start; build lại sau khi sửa code frontend.

## Kiểm thử

```powershell
cd Backend
.\.venv\Scripts\python.exe -m pytest -q
cd ../ui/userUI/Frontend
$env:PHUB_API_BASE_URL='http://127.0.0.1:18001'
$env:NEXT_TEST_WASM_DIR=(Resolve-Path 'node_modules/@next/swc-wasm-nodejs').Path # chỉ Windows cần WASM
npm.cmd run build -- --webpack
```

Build cần tải các font Google đang dùng trong UI. Render Linux dùng SWC native;
không đặt `NEXT_TEST_WASM_DIR` trên Render.

E2E: cài Playwright ở thư mục tạm nếu chưa có; đặt key trước khi khởi động Demo
để harness và server dùng cùng key. Sau đó chạy từ thư mục UI:

```powershell
# Từ thư mục gốc trước khi start Demo
$env:PHUB_E2E_CONTROL_KEY='isolated-local-shopping-test-key-20261006'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Demo -Production
# Nếu chưa có Playwright: npm.cmd install --prefix "$env:TEMP/phub-catalog-tools" --no-save --package-lock=false --ignore-scripts playwright
cd ui/userUI/Frontend
$env:PHUB_PLAYWRIGHT_MODULE=([System.Uri](Join-Path $env:TEMP 'phub-catalog-tools/node_modules/playwright/index.mjs')).AbsoluteUri
$env:PHUB_UI_URL='http://127.0.0.1:13001'
$env:PHUB_E2E_BACKEND_URL='http://127.0.0.1:18001'
node.exe scripts/check-shopping.mjs
```

Harness dùng Chrome đã cài, reset dữ liệu fixture và test desktop/mobile,
idempotency/retry, tiền chính xác, voucher, ownership và thanh toán. Kết quả ở
`.next/shopping-check/report.json`. Đây là E2E mua hàng với phiên giả lập.

## Deploy hai Web Services trên Render

[render.yaml](render.yaml) chỉ định nhánh `ui-review`, hai thư mục root riêng,
cổng `$PORT`, health check và biến môi trường. Không có migration tự chạy.
Không commit/push/deploy tự động trong thay đổi này; bạn đưa code đã kiểm tra
lên nhánh triển khai rồi tạo Blueprint từ nhánh đó, hoặc tạo từng service.
Nếu đổi nhánh, cập nhật `branch` ở cả hai service. Tên service có thể chỉnh
để tránh trùng dịch vụ khác của nhóm.

| Cấu hình | Backend | Frontend khách |
| --- | --- | --- |
| Type | Web Service, Python | Web Service, Node (có SSR/API proxy) |
| Root Directory | `Backend` | `ui/userUI/Frontend` |
| Build | `pip install -r requirements.txt -c constraints-render.txt` | `npm ci --include=dev && npm run build -- --webpack` |
| Start | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `npm run start -- --hostname 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` | `/api/health` |
| Runtime version | `PYTHON_VERSION=3.14.6` | `NODE_VERSION=24.21.0` |

Không chọn Static Site: UI cần tiến trình Next.js để proxy và render chi tiết.
Hai service đặt plan free cho bản test, auto deploy off; deploy thủ công khi bạn
sẵn sàng. URL thật do Render cấp, có thể thêm hậu tố nếu tên đã được dùng.

Biến môi trường Backend (điền trong Render Dashboard, không gửi khóa qua chat):

- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: project Supabase mục tiêu.
- `FRONTEND_URL`: origin HTTPS chính xác của UI, ví dụ `https://your-shop.onrender.com`.
  Nếu có nhiều giao diện cần truy cập API trực tiếp, dùng `FRONTEND_ORIGINS` dạng
  danh sách origin phân cách dấu phẩy; mặc định localhost cũ được giữ khi không cấu hình.
- Bốn biến `ORDER_*` và timezone giữ giá trị đã ghi trong Blueprint.

Biến môi trường Frontend:

- `PHUB_API_BASE_URL`: URL HTTPS của backend, ví dụ `https://your-api.onrender.com`.
- `PHUB_UI_ORIGIN`: origin HTTPS của chính UI, không thêm đường dẫn hoặc dấu `/` cuối.
- `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`.

Cập nhật URL sau khi Render cấp hai địa chỉ và redeploy services. Trong Blueprint,
`sync: false` yêu cầu điền giá trị lúc tạo; các lần sau chỉnh trực tiếp Dashboard.
Health 200 chỉ xác nhận tiến trình sống; test catalog để kiểm tra DB thật. Free
service có thể phải khởi động lại sau khi ngủ; nếu API chưa sẵn sàng, dùng nút thử
lại/cập nhật trên UI. Khi gửi đơn chưa rõ kết quả, giữ nguyên lần đặt/idempotency key.

Smoke test chỉ đọc sau deploy (từ Backend):

```powershell
.\.venv\Scripts\python.exe scripts/check_customer_deployment.py --api https://your-api.onrender.com --ui https://your-shop.onrender.com --auth-pending
```

Lệnh kiểm tra health, Swagger, catalog/proxy, validation, guest bị chặn và không
có routes fixture trên app production; không tạo đơn hoặc ghi database.

## Database và điểm bàn giao đăng nhập

Giữ database chung đến khi nhóm duyệt. Thứ tự migration trên database riêng/staging:
`Backend/migrations/20261004_customer_orders.sql` rồi
`Backend/migrations/20261006_customer_checkout.sql`. Đọc các điều kiện/kiểm tra
schema trong [orders README](Backend/app/orders/README.md) và
[commerce README](Backend/app/commerce/README.md) trước khi áp dụng.
Việc seed sản phẩm/kho/tồn/voucher/khách trong staging thuộc dữ liệu cần nhóm xác nhận;
không seed giả vào Supabase chung. Các script SQL local đã có fixture để kiểm tra
transaction mà không dùng project Supabase.

Thành viên đăng nhập chỉ cần bàn giao dependency trả
`CurrentCustomer(customer_id=ma_kh)` sau khi xác minh phiên/token và liên kết khách.
Proxy chuyển cookie/Authorization cùng origin. Nếu dùng bearer, UI có sẵn
`configureShoppingAuthorization` và sự kiện `phub:session-changed`, mô tả trong
[SHOPPING-INTEGRATION.md](ui/userUI/Frontend/SHOPPING-INTEGRATION.md).
Phần này chưa triển khai lại đăng nhập, không thêm bypass xác thực vào app production.

Khi auth và migration đã được nhóm nối, chạy E2E đăng nhập thật → đặt đơn ở staging,
kiểm tra quyền sở hữu, retry và giữ hàng với thành viên kho trước khi dùng thật.

## File bổ sung cho chạy/deploy

- `render.yaml`: định nghĩa hai dịch vụ customer.
- `Backend/app/runtime.py`, `health.py`: CORS theo env và health check trong Swagger.
- `constraints-render.txt`, `requirements-test.txt`: phiên bản runtime đã test, dependencies kiểm thử; requirements chung giữ nguyên.
- `src/lib/server/backend.ts`: hai proxy dùng cùng cấu hình backend; production phải khai báo URL, không fallback localhost âm thầm.
- `src/app/api/health/route.ts`: liveness của UI.
- `Backend/scripts/manual_shopping.py`: trang điều khiển fixture chỉ dùng local.
- `scripts/start-customer.ps1`, `stop-customer.ps1`: chạy/dừng đúng tiến trình của khách từ source hiện tại.
- `Backend/scripts/check_customer_deployment.py`: smoke test chỉ đọc cho app thật.
- `tests/test_runtime.py`, `test_manual_shopping.py`: CORS, health, quyền phiên mẫu, trạng thái thanh toán và reset.

Các hướng dẫn Render đối chiếu theo tài liệu chính thức:
[FastAPI](https://render.com/docs/deploy-fastapi),
[Next.js](https://render.com/docs/deploy-nextjs-app),
[Blueprint](https://render.com/docs/blueprint-spec),
[Python](https://render.com/docs/python-version),
[Node](https://render.com/docs/node-version).

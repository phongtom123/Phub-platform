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

`app/catalog/schemas.py` validation/model công khai, `repository.py` truy vấn/ánh
xạ ảnh và thông số, `router.py` routes/Swagger, `errors.py` lỗi riêng module.
UI nối proxy GET, home, search header, catalog grid/list, filter, preview/detail
desktop/mobile; query trong URL, loading/error/retry/not-found và ảnh placeholder.
Tài liệu: [catalog README](app/catalog/README.md),
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

`app/orders/schemas.py` request/receipt; `settings.py` quy tắc đã xác nhận;
`repository.py` transaction/lỗi allowlist; `router.py`, `errors.py` HTTP/Swagger/lỗi.
Migration 04/10 tạo schema key riêng và RPC v1; migration 06/10 bổ sung v2 hiện dùng.
Tài liệu file/request/triển khai: [orders README](app/orders/README.md).

## Mục tiêu 3 — Thanh toán và lịch sử giao dịch

Swagger **Customer Payments**: `GET /api/orders/{order_id}/payments` giao dịch
mới nhất, `GET /api/orders/{order_id}/transactions` lịch sử phân trang mới trước.
`app/payments` chỉ đọc `DON_HANG`, `THANH_TOAN`, không cần migration payment.
Kiểm tra chủ đơn rồi lọc lại quyền sở hữu ở truy vấn giao dịch. Đơn không tồn tại,
khách khác hoặc `ma_kh=NULL` cùng 404. Tiền là chuỗi Decimal; không trả mã thanh
toán/tham chiếu/payload nhạy cảm. Thành công/lỗi đều `no-store`.

`CHO_XU_LY` → `pending`, thông báo chưa xác nhận thành công. Chưa có giao dịch
không phải đã thanh toán; một khoản thu hoặc hoàn tiền không xác nhận toàn đơn
đã tất toán. UI có trạng thái/lịch sử trên chi tiết đơn và nút cập nhật.

Khó khăn vẫn để riêng theo yêu cầu: `auth.py::require_customer` cần kết quả xác
thực của thành viên đăng nhập, hiện luôn 503. Không tin cookie thô, bearer chưa
xác minh hay `X-Customer-Id` tự khai báo. Không tự gán lại đơn cũ.
Tài liệu file/handoff: [payments README](app/payments/README.md).

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

`app/commerce` dùng cùng dependency khách cho mọi route. Quote chọn một kho đủ
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
[commerce README](app/commerce/README.md). File map frontend, lưu trữ, auth handoff
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
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
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

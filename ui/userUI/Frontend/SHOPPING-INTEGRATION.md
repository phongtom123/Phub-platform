# Kết nối mua hàng khách hàng — desktop và mobile

Phiên khách đầu tiên đã được cho phép trên database thật: dùng `SupabaseTest`
theo [CUSTOMER-SUPABASE-TESTING.md](../../../CUSTOMER-SUPABASE-TESTING.md).
UI đọc được catalog/hồ sơ/giỏ thật; quote/voucher/đơn còn cần cài RPC.
Phiên test chỉ localhost, giữ nguyên đăng nhập của nhóm và cấu hình Render.

Tài liệu này mô tả mục tiêu 4 và cách kiểm thử ba API đã làm trước đó trên UI.
Các mục tiêu catalog, đặt đơn, thanh toán được tổng hợp trong
[Backend/README.md](../../../Backend/README.md). Chi tiết catalog giữ trong
[CATALOG-INTEGRATION.md](CATALOG-INTEGRATION.md); API checkout/voucher/đơn trong
[commerce README](../../../Backend/app/commerce/README.md).

Chạy test thủ công từ source hiện tại và deploy Render theo
[CUSTOMER-DEPLOYMENT.md](../../../CUSTOMER-DEPLOYMENT.md). Trang fixture local có
nút chọn khách A/B và các trạng thái thanh toán; không thay UI đăng nhập của nhóm.

Hướng dẫn thao tác từng chức năng local:
[CUSTOMER-TESTING.md](../../../CUSTOMER-TESTING.md).
Checkout đọc voucher bằng `useSearchParams` trong Suspense để giữ đúng mã khi
nhấn nút Thanh toán từ giỏ sang checkout; đọc `window.location.search` lúc mount có thể lấy
URL cũ trong điều hướng client và bỏ mất giảm giá. Kiểm thử
`scripts/check-manual-shopping.mjs` đi qua chính nút này và đối chiếu tổng đơn,
rồi test các nút kịch bản thanh toán trên trang fixture.

## Đã kết nối và điều kiện để chạy thật

Catalog/chi tiết vẫn công khai. Giỏ hàng, hồ sơ, checkout, lịch sử đơn và thanh
toán dùng danh tính khách đã được backend xác minh. Header hiển thị số lượng giỏ
chung; desktop/mobile, grid/list/preview/detail dùng cùng giỏ. Checkout lấy quote
thật, áp voucher qua backend, nhập người nhận, xác nhận đơn và mở chi tiết đơn.
Chi tiết đơn dùng snapshot lúc bán, không dùng lại giá catalog hiện tại.

**Hai điều kiện còn chờ nhóm:**

1. Module đăng nhập thật chưa được gộp vào workspace. `require_customer` hiện
   chủ động chặn API khách bằng 503; UI hiện thông báo chưa sẵn sàng, không giả
   lập tài khoản hoặc thông báo đặt thành công. Trang đăng ký/đăng nhập của thành
   viên khác không bị sửa. Login hiện có trong workspace vẫn chỉ điều hướng mẫu.
2. Hai migration đặt đơn và checkout mới được chuẩn bị, **chưa chạy trên Supabase
   chung**. Nhóm database/kho/khuyến mãi cần review và thử staging trước.

Vì vậy, UI mua hàng đã có code tích hợp nhưng chưa thể xác nhận đăng nhập thật
và tạo đơn thật trên database chung. Có thể kiểm thử toàn luồng bằng server
fixture riêng bên dưới mà không cần ghi dữ liệu Supabase.

## Trách nhiệm code

| File/thư mục | Nội dung |
| --- | --- |
| `src/lib/shopping/types.ts` | Hợp đồng hồ sơ, giỏ, quote, đơn và thanh toán |
| `src/lib/shopping/client.ts` | Fetch cùng origin, cookie/bearer bridge, lỗi và validation phản hồi |
| `src/lib/shopping/money.ts` | Tiền dạng chuỗi và BigInt để giữ chính xác đến hai số thập phân |
| `src/app/api/customer/[...path]/route.ts` | Proxy chỉ cho phép routes mua hàng; forwarding credential đến backend cố định |
| `src/components/shopping/ShoppingProvider.tsx` | Xác minh phiên, giỏ chung từng khách, khôi phục sản phẩm từ catalog |
| `CheckoutSummary.tsx`, `AddToCartButton.tsx` | Báo giá/voucher/tổng tiền và hành động thêm sản phẩm dùng chung |
| `src/app/cart/ShoppingCart.tsx` | Giỏ thật, sửa/xóa số lượng, quote và chuyển checkout |
| `src/app/checkout/CheckoutProcess.tsx` | Người nhận, kiểm tra đơn, gửi idempotent và retry khi chưa biết kết quả |
| `src/app/main/profile/AccountDashboard.tsx` | Hồ sơ/địa chỉ chỉ đọc và lịch sử đơn thực của khách |
| `src/app/main/orders/[id]/page.tsx`, `OrderView.tsx` | Chi tiết đơn theo quyền sở hữu |
| `OrderHistory.tsx`, `PaymentPanel.tsx`, `useCustomerResource.ts` | Pagination, trạng thái thu/hoàn tiền, loading/error/refresh |
| `scripts/check-shopping.mjs` | Chrome E2E với server fixture riêng, ảnh và báo cáo trong `.next/shopping-check` |

Root layout chỉ bổ sung provider; thay đổi catalog/header/detail là nối hành
động giỏ hiện có. Không đổi cấu trúc thư mục của thành viên khác, API sản phẩm
cũ, CORS chung, UI admin/kho hoặc cơ chế đăng nhập. Hồ sơ không còn hiện thông tin
Alex/email giả. Form checkout đã có `PUT /api/customer/me` để lưu thông tin nhận
hàng; trang hồ sơ vẫn chỉ đọc, không đổi phần đăng nhập của thành viên khác.

## Luồng mua hàng và tiền

1. `GET /api/customer/me` xác minh khách; guest 401 có đường dẫn đăng nhập, lỗi
   xác thực chưa tích hợp/không truy cập được có thông báo và thử lại.
2. Thêm sản phẩm tải lại catalog theo `ma_sp`, đối chiếu SKU; giỏ giới hạn tối đa
   100 SKU, mỗi SKU 1–1000. Sản phẩm không tải được khi khôi phục vẫn hiện để xóa;
   không dùng giá giả để đặt đơn.
3. Giỏ có hai nút **Chọn tất cả** và **Thanh toán**; mỗi dòng có ô chọn tròn.
   Quote/checkout chỉ gửi SKU/số lượng của các dòng được chọn cùng voucher.
   Không chọn sản phẩm thì nút Thanh toán bị vô hiệu hóa. Backend chọn kho, lấy giá, tính giảm và tổng;
   UI không tự có mã TECH10, thuế mẫu hay phí giao hàng $21.
4. `/checkout` hiện form khi khách thiếu thông tin nhận hàng. Nút **Lưu** ghi
   tên/điện thoại/địa chỉ vào database, độc lập với báo giá. Có đủ thông tin thì
   đi thẳng `/checkout/confirm`. Trang xác nhận hiển thị sản phẩm, địa chỉ đã
   lưu, voucher và quote; phương thức thanh toán/hóa đơn chưa có API thì để trống.
   Ghi chú nhập ở trang xác nhận. Xem [CHECKOUT-REVIEW.md](../../../CHECKOUT-REVIEW.md).
5. Gửi kho/giá/tổng đối chiếu từ quote cùng UUID v4. Backend kiểm tra lại giá,
   tồn, voucher và ghi nguyên khối; thành công mở `/main/orders/{id}` và trừ
   số lượng đã đặt khỏi giỏ, giữ những sản phẩm/số lượng mới thêm khác.
6. Hồ sơ → đơn → thanh toán hiển thị phương thức, số tiền, trạng thái và lịch
   sử thu/hoàn tiền. Nút cập nhật lấy lại dữ liệu; `pending` ghi rõ chưa xác nhận
   thành công. Không có giao dịch không được coi là đã trả tiền. Giao dịch mới
   nhất không phải kết luận toàn đơn đã tất toán; không hiển thị mã giao dịch thô.

Giá trước thuế, cạnh giá có dòng đỏ nhỏ **“chưa áp dụng thuế 10%”**. Tổng đặt đơn
không cộng thuế; 10% áp khi lập hóa đơn. Phí vận chuyển được xác nhận riêng.
Tạo đơn giữ hàng nhưng kho mới trừ tồn thực khi xuất. Không thu thập số thẻ/CVV
hoặc gọi PayPal giả; mục tiêu hiện tại là đặt đơn và đọc giao dịch đã ghi nhận.

### Retry, lưu trữ và quyền riêng tư

Giỏ lưu localStorage theo khách, chỉ gồm `product_id`, `sku`, `quantity`, `selected`; không
lưu credential, hồ sơ, giá hoặc kết quả thanh toán. Tên/ảnh/giá được tải lại từ catalog.
Khi đổi khách/mất phiên, state riêng của khách trước được bỏ khỏi màn hình.
Giỏ cũ thiếu `selected` được chọn mặc định; tải lại trang giữ lựa chọn đã lưu.
Sau đặt đơn, sản phẩm không được chọn vẫn nằm trong giỏ. Chi tiết sửa UI và kiểm thử:
[CUSTOMER-UI-REVIEW.md](../../../CUSTOMER-UI-REVIEW.md).

Trước POST, checkout lưu **một lần đặt chưa xác nhận** trong sessionStorage theo
khách: UUID và body đã chốt, bao gồm người nhận/địa chỉ/ghi chú. Việc lưu tạm này
cho phép retry đúng body sau reload. Dữ liệu chỉ ở tab hiện tại, không log hoặc
đưa vào URL; xóa khi thành công hoặc backend xác nhận thất bại rollback. Đây là
dữ liệu cá nhân tạm, không phải sổ địa chỉ; nhóm cần giữ nguyên retention tối thiểu
khi nối cơ chế đăng nhập/logout. Không lưu token/password vào hai loại storage này.

Mất kết nối/timeout hoặc lỗi chưa biết kết quả: khóa nội dung lần đặt và cho thử
lại bằng **cùng UUID/body**, kể cả sau reload hoặc giá thay đổi. Không tạo key mới
chỉ vì request lỗi. Lỗi giá/tồn/voucher xác nhận rollback: quay lại chỉnh, lấy quote
mới và xác nhận lại. Nhấp đúp bị chặn; server idempotency là bảo đảm cuối cùng.

Nếu tắt sessionStorage, UI không gửi đơn vì không giữ được lần đặt để retry.
Hãy dùng lịch sử đơn để kiểm tra nếu một lần đặt vẫn chưa thể xác nhận.

## Điểm nối cho thành viên phụ trách đăng nhập

Backend: nối `app/payments/auth.py::require_customer` với dependency xác thực thật
để trả `CurrentCustomer(customer_id=ma_kh)`, giữ lỗi 401/403 và cập nhật security
trong Swagger. Chỉ tin tài khoản đã xác minh, không tin mã khách client gửi.
Dependency này dùng chung cho tạo/đọc đơn, quote, hồ sơ và thanh toán.

Frontend: cookie cùng origin được fetch tự gửi, proxy chuyển Cookie/Authorization
sang FastAPI. Nếu module dùng bearer, gọi một lần trong code phiên của thành viên:

```ts
import { configureShoppingAuthorization } from "@/lib/shopping/client";
configureShoppingAuthorization(() => sessionStore.currentAuthorization());
```

Reader phải trả header đầy đủ như `Bearer ...` hoặc `null`; token chỉ giữ qua
module phiên, lớp mua hàng không tự tạo hay lưu token. Khi đăng nhập/đăng xuất/đổi
phiên, phát `window.dispatchEvent(new Event("phub:session-changed"))` để cập nhật.
Nhóm quyết định thuộc tính cookie, xác minh token, logout và routing sau login.
Proxy mua hàng không triển khai đăng nhập hay forward Set-Cookie của một login API.

Proxy dùng `PHUB_API_BASE_URL` ở server, không nhận địa chỉ backend từ client,
không theo redirect, timeout 20 giây và `no-store`. Chỉ forward GET me/orders/
payments/transactions, PUT me và POST quote/orders, body JSON tối đa 64 KiB, chặn ghi
khác origin. Khi deploy sau reverse proxy, cấu hình `PHUB_UI_ORIGIN` bằng origin
HTTPS công khai chính xác để kiểm tra origin; không thay CORS chung.

## Chạy bằng Backend thật

Hai terminal riêng từ thư mục gốc; giữ terminal chạy khi mở trình duyệt.

```powershell
# Terminal 1
cd Backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

```powershell
# Terminal 2
cd ui/userUI/Frontend
$env:PHUB_API_BASE_URL='http://127.0.0.1:8001'
# Chỉ cần hai dòng WASM nếu máy Windows chặn SWC native:
$env:NEXT_TEST_WASM_DIR=(Resolve-Path 'node_modules/@next/swc-wasm-nodejs').Path
npm.cmd run dev -- --webpack --hostname 127.0.0.1 --port 3001
```

UI `http://127.0.0.1:3001`, Swagger `http://127.0.0.1:8001/docs`.
Port 8001 tránh lỗi WinError 10013 đã gặp với 8000; nếu vẫn lỗi, kiểm tra cổng
được Windows cho phép, không tự dừng tiến trình của nhóm khác. Xem hướng dẫn cài
requirements/WASM ở tài liệu catalog. Không đưa khóa Supabase vào frontend.

Sau khi auth và migration được nhóm triển khai, test login → catalog/detail →
giỏ → voucher → checkout → đơn → thanh toán. Kiểm tra cả desktop/mobile, khách
khác không xem được đơn và retry cùng key. “Try it out” tạo đơn là ghi thật;
chỉ dùng database kiểm thử đã được nhóm chuẩn bị.

## Chạy E2E riêng ngay khi chưa nối auth/migration

Không dùng `app.main` hoặc database chung cho chế độ này. Backend fixture không
đọc `.env`, toàn bộ dữ liệu trong RAM, chỉ nhận kết nối loopback. Mode và control
key bắt buộc; routes `/__e2e/*` chỉ có trong server kiểm thử, không trong app thật.
Phiên xác thực được test harness giả lập, **không kiểm tra mật khẩu thật**.

Nếu thiếu công cụ trình duyệt:

```powershell
npm.cmd install --prefix "$env:TEMP/phub-catalog-tools" --no-save --package-lock=false --ignore-scripts playwright
```

Terminal 1 từ gốc:

```powershell
cd Backend
$env:PHUB_E2E_MODE='isolated-fixtures'
$env:PHUB_E2E_CONTROL_KEY='local-shopping-fixtures-only-20261006'
.\.venv\Scripts\python.exe -m uvicorn scripts.shopping_e2e_app:app --host 127.0.0.1 --port 18001
```

Terminal 2 từ gốc (dùng production build, không cần dừng dev của thành viên khác):

```powershell
cd ui/userUI/Frontend
$env:PHUB_API_BASE_URL='http://127.0.0.1:18001'
$env:NEXT_TEST_WASM_DIR=(Resolve-Path 'node_modules/@next/swc-wasm-nodejs').Path
npm.cmd run build -- --webpack
npm.cmd run start -- --hostname 127.0.0.1 --port 13001
```

Terminal 3 từ gốc:

```powershell
cd ui/userUI/Frontend
$env:PHUB_E2E_CONTROL_KEY='local-shopping-fixtures-only-20261006'
$env:PHUB_PLAYWRIGHT_MODULE=([Uri]::new((Join-Path $env:TEMP 'phub-catalog-tools/node_modules/playwright/index.mjs'))).AbsoluteUri
node scripts/check-shopping.mjs
```

Script chỉ nhận loopback và kiểm tra server fixture trước khi ghi; tạo đơn giả,
thử lỗi phản hồi sau commit, retry sau reload, voucher, tồn mock, hồ sơ,
giao dịch chờ/hoàn, phân trang, khác khách và sản phẩm ngừng bán. Ảnh/report ở
`.next/shopping-check/`, không commit. Dừng hai server test bằng Ctrl+C khi xong;
khởi động frontend với địa chỉ backend thật khi quay lại catalog Supabase.

SQL transaction có kiểm thử riêng bằng PostgreSQL thật ở
`Backend/scripts/check_checkout_database.mjs`, không suy ra tính đúng SQL từ mock.
E2E login thật còn chờ module của nhóm; tài liệu không coi phiên fixture là đã
hoàn thành xác thực production hoặc đã triển khai database chung.

Kết quả ngày 06/10/2026: 15 nhóm kiểm tra browser fixture đạt, không có lỗi
JavaScript runtime; có kiểm tra desktop/mobile và checkout mobile. Backend
271 tests, SQL checkout 26 kiểm tra PostgreSQL riêng đạt. TypeScript, lint
các file tích hợp và build production bằng Webpack/WASM đạt.

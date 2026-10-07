# UI → API → backend → Supabase thật

**Cập nhật 07/10/2026:** theo lựa chọn người dùng, chưa nối thực thi tạo
đơn/thanh toán thật. Luồng UI đầy đủ thử bằng fixture trong
[PAYMENT-UI-REVIEW.md](PAYMENT-UI-REVIEW.md). Đơn/hóa đơn/giao dịch có sẵn vẫn đọc được.

Nhánh **ui-review**. Người dùng đã cho phép dùng khách có `ma_kh` đầu tiên và
ghi dữ liệu để thử mua hàng, giữ nguyên cấu trúc database của nhóm. Backend
chọn `KHACH_HANG.ma_kh` tăng dần, lấy một dòng: **SEED_KH001** tại lần kiểm tra
06/10/2026. Không tạo khách/tài khoản mới hoặc đổi mật khẩu.

## Mở đúng UI để thử

Từ thư mục gốc, dừng Real/Demo nếu đang chạy trước khi start:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Demo
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Real
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode SupabaseTest
```

Nếu SupabaseTest đã chạy, chỉ mở link, không start thêm tiến trình.

1. Mở trực tiếp **http://127.0.0.1:3001/**, không cần đăng nhập hoặc mở phiên.
2. Backend test local tự dùng khách đầu tiên **SEED_KH001**, UI đọc hồ sơ qua
   API thật. Catalog/banner vẫn là giao diện hiện có.
3. Mở sản phẩm → thêm giỏ → chọn các sản phẩm muốn mua → Thanh toán.
   Khách thiếu thông tin thì nhập form và bấm **Lưu**; khách đủ thông tin đi thẳng
   trang xác nhận đơn. Nút Lưu dùng Data API, không phụ thuộc RPC checkout.
   Báo giá/voucher/đặt đơn chỉ chạy được sau khi cài RPC bên dưới.
   Phương thức thanh toán/hóa đơn chưa kết nối sẽ để trống;
   xem [CHECKOUT-REVIEW.md](CHECKOUT-REVIEW.md).
4. Hồ sơ tại `/main/profile`; khi RPC sẵn sàng, xem lịch sử/chi tiết đơn và
   thanh toán. Đặt đơn không tự tạo hóa đơn hoặc giao dịch thu tiền.

Đã tạm ngắt bước đăng nhập theo yêu cầu: `-Mode SupabaseTest` mặc định đặt
`PHUB_SUPABASE_TEST_AUTO_CUSTOMER=1` trong tiến trình test riêng, không cần cookie.
Để trở lại kiểm tra phiên/đăng xuất, dừng SupabaseTest rồi chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode SupabaseTest -RequireTestSession
```

Khi dùng `-RequireTestSession`, mở `http://127.0.0.1:8001/__supabase_test` và bấm
mở UI; cookie có hiệu lực 1 giờ. Dùng host `127.0.0.1` xuyên suốt. Swagger:
**http://127.0.0.1:8001/docs**. Chế độ này dùng cùng API/model/repository với
production và Supabase thật, không dùng database giả lập trong RAM.

## Đã xác minh và phần còn thiếu

| Phần | Kết quả trên Supabase hiện có |
| --- | --- |
| Catalog/chi tiết | 33 sản phẩm; ảnh/mô tả từ database, thiếu ảnh thì placeholder |
| Phiên khách test/hồ sơ | Browser cookie → proxy Next → API → `KHACH_HANG`: 200, khách `SEED_KH001` |
| Chi tiết sản phẩm → giỏ | Thao tác UI thật đạt; viewport 375/1280 không tràn ngang |
| API thanh toán/lịch sử giao dịch | Đơn có sẵn `SEED_DH001`: hai API trả 200, một giao dịch thành công |
| Lịch sử/chi tiết đơn và hóa đơn có sẵn | Đọc trực tiếp có quyền sở hữu khi chưa có RPC đọc đơn |
| Quote, voucher, tạo đơn | RPC chưa tồn tại; API trả `503 CHECKOUT_DATABASE_NOT_READY` |
| Yêu cầu thanh toán mới | Chưa nối thực thi; trả `503 PAYMENT_INTEGRATION_REQUIRED`, không ghi DB |
| Đăng nhập bằng mật khẩu | Giữ công việc của thành viên phụ trách; phiên local không kiểm tra mật khẩu |

**Chưa chứng nhận checkout hoàn chỉnh trên Supabase thật.** 370 Python tests
đạt; browser check phiên thật/hồ sơ/catalog/giỏ/mobile/logout đạt, không ghi DB.
Các E2E mua hàng trước đó dùng fixture riêng, không chứng minh RPC đã được cài.
Sửa bộ lọc giá/màu/tồn, hai nút xem nhanh và lựa chọn giỏ hàng được mô tả tại
[CUSTOMER-UI-REVIEW.md](CUSTOMER-UI-REVIEW.md). Kiểm thử trình duyệt của đợt này
chỉ đọc database và kiểm tra request báo giá, không tạo đơn thật.

Đã sửa lỗi filter hồ sơ/thanh toán: `.eq()` của SDK nhận giá trị trực tiếp,
HTTP client tự encode query; thêm JSON dấu ngoặc kép làm mã khách thật không
khớp. Test hồi quy giữ bộ lọc quyền sở hữu ở cả truy vấn đơn và giao dịch.

## Bổ sung RPC, giữ nguyên bảng hiện có

`SUPABASE_URL`/`SUPABASE_SECRET_KEY` kết nối được Data API, không cung cấp kết
nối SQL để cài hàm PostgreSQL. `SUPABASE_DB_URL` hiện vẫn chứa `[YOUR-PASSWORD]`,
chưa có mật khẩu database thật hoặc management token. Đây là thông tin kết nối còn thiếu,
không phải yêu cầu duyệt lại quyền test dữ liệu đã được cho phép.

Có hai cách:

- **Để tôi thực hiện:** Supabase Dashboard → Connect → sao chép connection
  string Direct connection hoặc Session pooler phù hợp mạng, thay password,
  thêm `SUPABASE_DB_URL=...` vào **Backend/.env** trên máy. Không gửi mật khẩu
  qua chat, không đưa URL này vào frontend hoặc commit. Tôi sẽ kiểm tra schema/
  triggers rồi chạy phần bổ sung đã chuẩn bị, không sửa cột/sequence/trigger.
- **Bạn chạy trong SQL Editor:** mở đúng project và thực hiện các file theo
  thứ tự bên dưới. Nếu guard báo thiếu identity/serial, dừng và gửi lỗi;
  không sửa bảng để ép migration chạy.

Thứ tự SQL:

1. [inspect_order_schema.sql](Backend/migrations/inspect_order_schema.sql): **chỉ
   đọc**, kiểm tra constraints/triggers và identity/serial.
   `CT_DON_HANG.ma_ct_donhang`, `SU_DUNG_VOUCHER.ma_su_dung` cần generator hiện
   có. Trigger phải phù hợp quy tắc chỉ trừ tồn lúc xuất kho.
2. [20261004_customer_orders.sql](Backend/migrations/20261004_customer_orders.sql):
   thêm schema `customer_order_private`, bảng idempotency riêng và RPC v1.
3. [20261006_customer_checkout.sql](Backend/migrations/20261006_customer_checkout.sql):
   thêm `customer_checkout_v2`, `customer_read_orders_v2`, chỉ `service_role`
   được execute. Hai migration có transaction/guard, chạy một lần; không sửa
   bảng/cột, trigger hoặc sequence hiện có. Không chạy fixture/seed.

Chạy xong báo lại kết quả để tôi kiểm tra quote/voucher/idempotency và một đơn
test thật qua UI. Không xóa đơn cũ/sửa thanh toán/tồn kho để test thành công.
Đơn tạo giữ hàng qua trạng thái đơn, tồn thực chỉ trừ lúc xuất kho. Giá chưa
gồm VAT; tiền thuế lúc đặt bằng 0, thuế 10% áp lúc lập hóa đơn.

Hướng dẫn connection string:
[Supabase — Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Code phiên test và giới hạn triển khai

- `Backend/scripts/supabase_shopping_test.py`: entrypoint riêng, kiểm tra mode
  local trước khi tải credential/kết nối; không được dùng trên Render.
- `Backend/scripts/supabase_test_support.py`: chọn khách ở server, tự cung cấp
  danh tính trong chế độ tạm ngắt đăng nhập; hoặc cấp cookie
  ngẫu nhiên HttpOnly/SameSite Strict, hết hạn/thu hồi; override dependency
  trong app test riêng. Chặn host/client ngoài loopback, cross-site và Render.
- `Backend/tests/test_supabase_local.py`: 19 test phiên/giả mạo/cross-site/local/
  Render/hết hạn/thu hồi, truy cập không cookie và giữ auth production.
- `ui/userUI/Frontend/scripts/check-supabase-session.mjs`: Chrome check chỉ đọc
  database, báo rõ RPC còn thiếu và chưa chứng nhận checkout hoàn chỉnh.
  Báo cáo: `.next/supabase-session-check/report.json`.
- `scripts/start-customer.ps1`, `stop-customer.ps1`: thêm `-Mode SupabaseTest`,
  log/PID riêng tại `.customer-runtime`. Dừng/start lại sau sửa backend.

Render vẫn chạy **app.main:app**, không import app test/nhận cookie test.
Đăng nhập thật vẫn cần nhóm nối `require_customer`; không deploy khách cố
định. Không đổi code admin/kho/auth hoặc tự deploy.

Chạy lại browser check từ frontend khi server SupabaseTest đang chạy:

```powershell
$env:PHUB_PLAYWRIGHT_MODULE=([System.Uri](Join-Path $env:TEMP 'phub-catalog-tools/node_modules/playwright/index.mjs')).AbsoluteUri
node scripts/check-supabase-session.mjs
```

Playwright/Chrome cần có sẵn theo [CUSTOMER-DEPLOYMENT.md](CUSTOMER-DEPLOYMENT.md).
Browser check dùng context riêng và hỗ trợ cả truy cập thẳng không đăng nhập lẫn
phiên cookie. Trong lần kiểm tra này không ghi/xóa dữ liệu Supabase.

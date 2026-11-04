# UI đặt đơn, hóa đơn và thanh toán để thử nghiệm

Cập nhật 07/10/2026 trên `ui-review`. Theo lựa chọn người dùng, **chưa thực thi
tạo đơn/thanh toán trên Supabase thật**. Không chạy migration, sửa cấu trúc
database, đăng nhập/admin/kho hoặc xác nhận thu tiền thật.

## Mở UI và test toàn luồng

Giao diện/backend fixture riêng đang chạy, dữ liệu trong RAM. Mở
**http://127.0.0.1:18001/__manual** → **Mở giao diện với khách A**.
Trình duyệt nhận phiên thử rồi mở http://127.0.0.1:13001/main/product.
Không cần mật khẩu. Nếu server đã chạy, không start lần nữa.

Nếu cần khởi động từ thư mục gốc:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode SupabaseTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Real
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Demo
```

Bản đang mở sau kiểm thử dùng frontend đã build (`-Mode Demo -Production`).
Lệnh trên chạy dev để sửa UI; dùng `-Production` nếu muốn chạy lại bản build.

1. Mở Laptop thử nghiệm, thêm giỏ, đổi số lượng/chọn dòng muốn mua. SKU-A có
   giá 100.000,10 ₫, tồn 5; thử số lượng vượt tồn để kiểm tra lỗi.
2. Thanh toán: thiếu thông tin thì nhập và Lưu; khách A/B mẫu đủ thông tin sẽ
   đi thẳng xác nhận. Có nút Sửa thông tin nhận hàng.
3. Xác nhận có sản phẩm, địa chỉ, voucher (`SAVE10` giảm 10%), chọn phương thức,
   **đơn giá và thành tiền từng dòng**. Đây là thông tin trước thuế, chưa phải hóa đơn đã lập.
4. Đặt đơn mở chi tiết đơn. Xem snapshot lúc bán và trạng thái hóa đơn.
5. Chọn phương thức → **Yêu cầu thanh toán**. Fixture tạo hóa đơn mẫu VAT 10%
   và giao dịch **đang chờ**, hiển thị phương thức/số tiền. Không thu tiền thật.
6. Dùng các nút ngay trên UI đơn: **Mô phỏng Đang chờ / Thành công / Thất bại / Hoàn tiền**.
   Xem lịch sử giao dịch và thử Cập nhật thanh toán.
7. Tài khoản → Đơn hàng của tôi để mở lại đơn. Chọn khách B ở `/__manual` rồi
   thử URL đơn A: không xem được đơn/hóa đơn/thanh toán của A.

Checkout/chi tiết đơn ghi rõ **Chế độ thử nghiệm**. Nút mô phỏng chỉ hiện khi
backend fixture đánh dấu phản hồi hồ sơ; endpoint mô phỏng không đăng ký ở
`app.main`. Không gọi cổng thu tiền. Dữ liệu mất khi reset/khởi động lại.
Không chạy Demo trên Render. Dừng mode hiện tại trước khi đổi mode frontend.

## SKU, giá/tồn và idempotency

SKU là mã phiên bản sản phẩm được đặt. Backend kiểm tra sản phẩm/loại/kho đang
hoạt động, lấy giá từ database và tồn sau giữ hàng. Giá client chỉ dùng đối
chiếu: giá/tồn thay đổi trước lúc gửi thì cần kiểm tra/xác nhận lại. Giữ hàng
khi đặt; kho trừ tồn thực khi xuất, đúng quy tắc nhóm.

Mỗi lần đặt mới có UUID v4 ở `Idempotency-Key`. Nhấn đúp/mất phản hồi/reload
retry giữ **cùng key và body**, nhận lại đơn cũ. Cùng key nhưng khác nội dung
bị từ chối. Checkout giữ lần đặt chưa xác nhận trong sessionStorage theo khách,
không hiển thị key hoặc mã giao dịch trong UI. Yêu cầu thanh toán thử cũng giữ
key/phương thức khi chưa rõ kết quả; không nhận số tiền do client tự khai báo.

## Đọc Supabase thật

Đọc lịch sử/chi tiết đơn dùng RPC nếu có; khi RPC đọc chưa tồn tại, `reads.py`
đọc `DON_HANG`/`CT_DON_HANG`, áp quyền sở hữu ở từng truy vấn và kiểm tra lại
dữ liệu trả về. Tiền/tên/đơn vị là snapshot lúc bán, không dùng giá catalog mới.

`GET /api/customer/orders/{id}/invoice` đọc tổng từ `HOA_DON` và dòng đơn thuộc
khách, hiển thị đơn giá/thành tiền. Không có hóa đơn trả `invoice=null`.
Không trả người lập, mã số thuế, mã thanh toán/giao dịch hoặc payload nội bộ.
API thanh toán giữ phương thức/số tiền/trạng thái/thời gian và lịch sử phân trang.
Đang chờ ghi rõ **chưa xác nhận thành công**; giao dịch mới nhất không tự chứng
minh toàn đơn đã tất toán. Đã kiểm tra chỉ đọc: **2 đơn, 1 hóa đơn, 3 giao dịch**
của khách test; không ghi database.

Muốn xem dữ liệu thật, dừng Demo rồi chạy SupabaseTest theo
[CUSTOMER-SUPABASE-TESTING.md](CUSTOMER-SUPABASE-TESTING.md).

## Phần thực thi để lại

Tạo đơn trên database chung vẫn cần RPC transaction đã chuẩn bị. Không bật gửi
khi chưa có báo giá xác nhận hoặc dùng CRUD rời rạc để giả đặt thành công.
Trang xác nhận có bảng tạm tính từ catalog; giá cuối cùng để trống khi chưa có quote.

`POST /api/orders/{id}/payment-request` nhận `{ "method": "bank_transfer" }`
và UUID v4. Production là điểm nối **chưa thực thi**, trả
`503 PAYMENT_INTEGRATION_REQUIRED` sau kiểm tra quyền sở hữu; không ghi Supabase,
lập hóa đơn hoặc thu tiền. Chỉ fixture override riêng mô phỏng hóa đơn/pending.
Chưa có cổng thanh toán/tài khoản nhận tiền/xác minh nhà cung cấp. Khách không
được tự xác nhận thành công trên backend thật.

`HOA_DON.nguoi_lap` bắt buộc thuộc phần lập hóa đơn của nhóm; không tự gán một
nhân viên để tạo hóa đơn thật. Không có mật khẩu SQL không ngăn Data API đọc/ghi;
chỉ chưa cài được RPC từ cấu hình hiện tại. Có thể dùng SQL Editor khi nhóm nối
thực thi; đợt này giữ lựa chọn để lại phần đó.

## Code và kiểm thử

- Backend: `commerce/reads.py`, schemas/router/repository; `payments/requests.py`
  và router cho điểm nối thanh toán. Swagger đã cập nhật.
- Frontend: `CheckoutProcess`, `InvoicePanel`, `PaymentMethodField`, `PaymentPanel`,
  `OrderView`, proxy/client/types. Giá và thành tiền có trên bảng xác nhận/hóa đơn.
- `scripts/shopping_e2e_app.py` mô phỏng invoice/payment/idempotency trong RAM;
  giữ server/phiên test riêng, không import từ app production.
- Toàn suite backend **370 tests đạt**, gồm quyền sở hữu, validation, lọc dữ liệu
  nhạy cảm và chứng minh điểm nối payment production không ghi database.
- `scripts/check-payment-ui.mjs`: 4 nhóm browser kiểm tra toàn luồng, pending,
  giá/hóa đơn, chống trùng, response-loss/reload retry, các trạng thái, khách khác,
  lịch sử và responsive 320/375/1280px. Báo cáo `.next/payment-ui-check`.
- Checkout review và 15 nhóm shopping E2E đạt sau sửa mobile overflow của bảng mới.
  5 kiểm tra manual UI cũng đạt. TypeScript/ESLint và build production Webpack đạt;
  4 nhóm payment UI được chạy lại thành công trên bản build, fixture đã reset
  để người dùng thử. Tài liệu bổ sung:
  [CHECKOUT-REVIEW.md](CHECKOUT-REVIEW.md), [CUSTOMER-TESTING.md](CUSTOMER-TESTING.md).

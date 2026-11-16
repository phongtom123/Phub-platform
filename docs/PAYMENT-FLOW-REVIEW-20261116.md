# Review luồng thanh toán local — 16/11/2026

## Bản được kiểm tra

- Thư mục: `C:\Users\Thinh\Desktop\BanPC`.
- Nhánh `feat/backend-middleware-api`, commit `f573d75`; giữ nguyên các thay đổi đang có.
- UI khách cấu hình `PHUB_API_BASE_URL=http://127.0.0.1:8000`; backend local có `PAYMENT_DEMO_ENABLED=true`.
- Khi bắt đầu kiểm tra không có server lắng nghe ở các cổng 3000/3001/3002/8000/8010. Browser fixture được chạy bằng UI local ở cổng tạm 3011, không gửi giao dịch vào dữ liệu thật.
- Đọc metadata Supabase xác nhận chưa có `staff_order_fulfillment_v1` và trigger `thanh_toan_advance_paid_online`. Không áp dụng migration trong phiên này.

## Luồng hiện tại

1. Khách thêm giỏ/xem báo giá: không tạo thanh toán, không giữ hàng.
2. Đặt hàng thành công: tạo đơn, dòng đơn theo từng kho, sử dụng voucher nếu có và tạo hóa đơn trong cùng transaction. Có hóa đơn thì giữ hàng; chưa trừ tồn vật lý, chưa có nghĩa đã thanh toán.
3. Hóa đơn ONLINE mới có hạn thanh toán 24 giờ. Cron Supabase `phub-expire-unpaid-invoices-24h` đang bật, chạy mỗi phút; lượt gần nhất đọc được có trạng thái `succeeded`. Đơn quá hạn chưa có khoản thu thành công được hủy và nhả reservation; đơn đã có khoản thu thành công, kể cả một phần, không bị hủy theo chính sách này.
4. Khách bấm thanh toán: frontend gửi phương thức và UUID idempotency đến `/api/orders/{id}/payment-request` qua gateway Next.js. Backend kiểm tra phiên và quyền sở hữu đơn.
5. Khi bật bypass, RPC tính số còn phải thu từ hóa đơn trừ khoản thu thành công và cộng lại khoản hoàn. RPC đối chiếu dòng hàng với hóa đơn, ghi khoản thu `THANH_CONG`, đánh dấu `la_bypass`, lưu khóa thử lại và chuyển đơn ONLINE sang `DANG_CHUAN_BI`. Các thay đổi cùng transaction; lỗi ghi sau đó thì rollback. Không có bước chuyển tiền qua ngân hàng/cổng thanh toán thật.
6. Nhân viên có thể ghi nhận khoản thu thực tế trong chi tiết đơn: mặc định số còn phải thu, có thể thu một phần; backend chặn số tiền vượt số còn phải thu. Ở schema đang cài, luồng này chưa có trigger tự chuyển ONLINE sang chuẩn bị như nhánh rút gọn giao hàng.
7. Chỉ xuất kho mới trừ tồn vật lý. Hoàn thành yêu cầu đã xuất và thu đủ tiền; thanh toán thành công không tự hoàn thành đơn.
8. Hủy đơn chưa xuất nhả reservation, không cộng lại tồn vật lý. Khoản thu thực tế chưa hoàn cần nhân viên xử lý; chỉ khoản bypass có cơ chế hoàn mô phỏng trong RPC hủy.

## Các điểm còn thiếu hoặc gây nhầm

### 1. P2 — COD/chuyển khoản chưa được lưu như lựa chọn của đơn

`ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx:256` dựng request tạo đơn không có phương thức thanh toán. Sau khi tạo đơn, lựa chọn chỉ được lưu vào `sessionStorage` ở dòng 288. Schema `CustomerOrderRequest` cũng không có trường này.

Do đó lựa chọn này chỉ giúp điền trước form thanh toán trên cùng tab. Mở bằng trình duyệt/thiết bị khác không khôi phục được lựa chọn từ server; nhân viên không thể dựa vào đơn để phân biệt khách đã chọn COD hay chuyển khoản nhưng chưa trả tiền. Cần lưu ý trước khi dùng lựa chọn này cho quy tắc bàn giao, nhắc thanh toán hay hủy quá hạn.

### 2. P2 — Nút thanh toán chưa dựa vào số dư và trạng thái đơn đầy đủ

`ui/userUI/Frontend/src/components/shopping/PaymentPanel.tsx:170-196` chỉ ẩn form cho đơn hủy/hết hạn; điều kiện vô hiệu hóa dựa vào giao dịch pending hoặc cờ demo đi cùng giao dịch thành công. Chưa dựa vào tổng hóa đơn trừ thu/hoàn và chưa loại trạng thái đã xuất/hoàn thành.

Đã tái hiện trên Chromium bằng API fixtures:

- Khoản thu do nhân viên ghi nhận đã đủ hóa đơn, không có cờ demo: nút “Thanh toán bypass” vẫn bấm được. Backend thực tế có kiểm tra `ORDER_ALREADY_PAID`, nên không đồng nghĩa bị thu hai lần.
- Đơn giao tận nơi ở `DA_XUAT_KHO`: nút vẫn bấm được nhưng RPC thanh toán khách chỉ nhận `MOI/XAC_NHAN/DANG_CHUAN_BI`, nên yêu cầu bị từ chối `ORDER_NOT_PAYABLE`.

Nên trả/hiển thị tổng phải trả, thực thu sau hoàn và còn phải thu; chỉ cho thao tác phù hợp với trạng thái. Với COD đã bàn giao, giải thích việc nhân viên xác nhận thu tiền thay vì hiện nút sẽ luôn bị từ chối.

### 3. Bypass không phải thanh toán thực tế

Trong cấu hình local hiện tại, chọn tiền mặt rồi bấm “Thanh toán bypass” vẫn ghi nhận thành công ngay. Đây là hành vi mô phỏng hiện có, không phải xác nhận khách đã giao tiền mặt hay chuyển khoản. Tắt bypass hiện trả `PAYMENT_INTEGRATION_REQUIRED`; chưa có nhà cung cấp thanh toán thật được ghép vào service này.

## Kiểm thử và giới hạn

- Python: `test_payments.py`, `test_admin_operations.py`, `test_orders.py`: **185 đạt**.
- PostgreSQL biệt lập: `test_demo_payments.cjs`, `test_payment_deadline.cjs`, `customer-cancel-order-sql.test.cjs`: **đều đạt**; có kiểm tra idempotency, số dư, rollback, ownership, hạn thanh toán và tồn vật lý.
- Chromium fixtures: test hạn thanh toán ở desktop 1440px và mobile 390px đều đạt.
- Chromium probe riêng: bypass tiền mặt gửi một request có khóa, cập nhật đơn/thanh toán, khóa nút sau bypass; đồng thời tái hiện hai vấn đề nút nêu trên.
- Supabase: chỉ đọc định nghĩa hàm và metadata cron, không tạo/thanh toán/hủy đơn thật. Kết quả fixture không được hiểu là đã kiểm thử giao dịch thực tế trên Supabase hoặc Render.
- Chưa sửa source nghiệp vụ, chưa push/deploy, chưa chạy migration.

# Email người mua tại quầy

## Hành vi

Cả `/counter` và `/data/orders?workflow=new` dùng chung `CounterBuyerFields`.
Tên người mua và email bắt buộc; số điện thoại là thông tin phụ, không dùng làm
khóa nhận diện tài khoản.

- **Khách có tài khoản:** nhập email → Tìm khách theo email → lấy họ tên và số
  điện thoại. Chỉ dùng tài khoản khách đang hoạt động, chưa xóa mềm; email được
  so khớp đầy đủ, không tìm theo tên, SĐT hoặc mã khách. Sửa email/đổi chế độ sẽ
  xóa tài khoản đã chọn; kết quả tra cứu cũ bị hủy và không được gán nhầm.
- **Khách vãng lai:** nhập họ tên và email, không cần tạo/chọn tài khoản. Email
  trùng một tài khoản có sẵn cũng không tự gán `ma_kh`. Liên kết đơn cũ với tài
  khoản vẫn phải qua quy trình xác minh liên kết hóa đơn.

API kiểm tra email và chọn đúng chủ đơn trong transaction. Không dùng việc sửa
email của tài khoản hoặc tạo tài khoản ngầm để lập đơn tại quầy.

## Lưu dữ liệu

`DON_HANG.email_nguoi_mua` lưu email đã chốt của người mua. Email này không bị
thay đổi khi tài khoản đổi email về sau. Đơn lịch sử chưa ghi nhận giữ NULL,
không điền dữ liệu suy đoán. Chi tiết đơn hiển thị email đã ghi nhận.

Request tạo đơn có `buyer_email` bắt buộc. Cả hai endpoint tạo đơn gọi RPC
`staff_counter_order_email_v1`; RPC dùng lại transaction `admin_operation_v1`
và idempotency hiện tại, đồng thời kiểm tra email thực sự được lưu. Database
chưa có RPC mới thì API báo 503 trước khi ghi; không fallback tạo đơn thiếu email.

Tra cứu email dùng `staff_counter_customer_email_v1` chỉ dành cho service_role,
kiểm tra lại actor NHAN_VIEN và chỉ trả thông tin cần thiết; không trả mật khẩu.

## Migration và kiểm tra

Migration: `Backend/migrations/20261107030114_counter_buyer_email.sql`, sau
`20261106142849_staff_operational_workspace.sql` và các migration tiền nhiệm.
Migration mới chỉ được kiểm thử biệt lập, **chưa áp lên Supabase thật**.
Triển khai cùng backend/UI mới vì endpoint tạo đơn đã yêu cầu email.

Đọc đơn cũ vẫn hoạt động khi cột email chưa được thêm: repository chỉ xử lý lỗi
thiếu đúng cột mới, giữ nguyên filter và ownership, trả email chưa ghi nhận.
Không áp dụng cách tương thích này cho thao tác ghi.

- `Backend/tests/test_counter_buyer_email.py`: validation, lookup đúng email,
  hai API tạo đơn, chủ đơn rõ ràng và tương thích đọc đơn cũ.
- `Backend/tests/staff-workspace-sql.test.cjs`: PostgreSQL biệt lập xác nhận
  email lưu đúng, guest không bị tự gán tài khoản, đối chiếu email/tài khoản,
  rollback khi sai và retry không tạo đơn trùng.
- `ui/warehouseUI/tests/counter-buyer.e2e.cjs`: trình duyệt với API fixtures,
  không ghi dữ liệu thật. Dùng Playwright từ `PHUB_PLAYWRIGHT_MODULE` hoặc package
  `playwright`; URL mặc định localhost:3002 (`PHUB_STAFF_TEST_URL` để đổi URL).

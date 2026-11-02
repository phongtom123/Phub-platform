# Thanh toán bypass

Thay bước thanh toán thật bằng nút **Thanh toán bypass**. Khách đăng nhập có thể bấm nút cho đơn ONLINE mới thuộc chính mình; không cần chọn tài khoản demo riêng.

## Kích hoạt

1. Áp dụng migration nâng cấp `migrations/20261102071529_customer_demo_payments.sql` trên database tương ứng. Không chạy lại initial schema.
2. Deploy backend mới và đặt `PAYMENT_DEMO_ENABLED=true` trong môi trường backend. Mặc định là `false`.
3. Chạy/deploy website khách hàng với backend đó trong `PHUB_API_BASE_URL`, rồi tải lại hồ sơ đăng nhập.

Backend trả `payment_bypass_enabled` trong `GET /api/customer/me`; frontend dùng giá trị này để hiện nút. Không dùng biến `NEXT_PUBLIC_*` hoặc cờ do khách gửi để cấp quyền bypass.

## Luồng sử dụng

- Đặt đơn → bấm **Thanh toán bypass** ngay tại màn hình xác nhận hoặc trang chi tiết đơn.
- Gọi `POST /api/orders/{order_id}/payment-request` với JSON `{"method":"bank_transfer"}`, header `Idempotency-Key` là UUID v4 và Origin hợp lệ.
- Backend xác minh phiên, chủ đơn; SQL khóa đơn, tính số tiền từ các dòng đã lưu, ghi giao dịch giả lập và chuyển `MOI → DANG_CHUAN_BI` trong cùng transaction.
- Thành công trả `latest_transaction.status=succeeded`, kèm `demo.order_status=DANG_CHUAN_BI`. Frontend cập nhật nội dung đơn, không tải lại toàn bộ trang.
- Bấm lại cùng khóa và cùng nội dung trả kết quả đã ghi. Khóa dùng cho đơn/phương thức khác bị từ chối. Một đơn không được bypass thành công lần thứ hai bằng khóa mới.

Số tiền gồm giá trị sau giảm giá và thuế theo từng dòng, sử dụng `numeric` và `round(...,2)` giống bước lập hóa đơn hiện tại. Frontend không gửi số tiền hoặc trạng thái mong muốn.

## Phạm vi dữ liệu

- Giao dịch và snapshot nằm riêng trong schema `payment_demo`, không ghi vào `THANH_TOAN` hoặc tự tạo `HOA_DON`; tiền giả lập không cộng vào thu tiền thật.
- Chỉ nhận đơn ONLINE ở trạng thái MOI, chưa có hóa đơn/giao dịch thật. Không chuyển đổi đơn đã có giao dịch thật sang giả lập.
- Đơn bypass không được xuất kho, hoàn thành, lập hóa đơn hoặc ghi khoản thu thật. Có thể hủy ở Admin để giải phóng lượng giữ chỗ. Tồn kho vật lý không đổi khi bypass.
- Khi tắt chế độ, các đơn giả lập vẫn giữ dấu vết và các chốt bảo vệ trên database; lịch sử giả lập được đọc khi bật lại chế độ.
- RPC chỉ cấp quyền cho `service_role`. Trình duyệt không được đọc/ghi trực tiếp schema riêng.

## Xác minh

Đã kiểm tra API về quyền sở hữu, Origin, số tiền do server cung cấp, chế độ tắt và phản hồi lỗi; kiểm tra SQL trong PostgreSQL cô lập về làm tròn, chống trùng, rollback, không ghi tiền thật và không xuất kho. Không tạo thanh toán thử trên database thật.

Migration đã áp dụng trên Supabase **Phub** ngày 02/11/2026. RPC đã được kiểm tra bằng truy vấn đọc với mã đơn không tồn tại. Backend/biến môi trường Render chưa được deploy hoặc thay đổi trong đợt này.

Website local `http://localhost:3000` đã chuyển sang backend mới `http://127.0.0.1:8000`, bật `PAYMENT_DEMO_ENABLED=true` trong `Backend/.env`. Supabase server key và khóa JWT chỉ lưu trong file backend được Git bỏ qua; UI không chứa các secret này. Cần đăng nhập lại sau khi đổi từ Render sang backend local vì khóa ký phiên khác nhau.

Gateway local đã kiểm tra tải danh mục HTTP 200 và từ chối request không có phiên bằng HTTP 401; RPC kết nối được qua backend local. Lỗi mạng được ghi log dạng mã lỗi và loại tài nguyên, không ghi cookie, token hoặc nội dung yêu cầu. Khi gửi đơn gặp lỗi chưa xác định kết quả, checkout giữ lại khóa idempotency để lần thử lại cùng nội dung không tạo đơn trùng.

Security Advisor không phát sinh cảnh báo WARN mới. Thông tin [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) ở `payment_demo.attempts` là chủ đích: mặc định từ chối mọi role thường, chỉ backend `service_role` có quyền và bypass RLS. Hai cảnh báo sẵn có về quyền thực thi hàm `rls_auto_enable` đã tồn tại trước migration, không thuộc thay đổi này.

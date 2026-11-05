# Thanh toán bypass

Bypass chỉ bỏ bước gọi cổng thanh toán. Kết quả được lưu vào các bảng nghiệp vụ trên Supabase, không dùng dữ liệu mẫu để thay thế database.

## Kích hoạt

1. Áp dụng lần lượt `migrations/20261102071529_customer_demo_payments.sql` và `migrations/20261102081903_bypass_business_payments.sql`. Database đã áp dụng migration đầu chỉ cần chạy migration sau. Không chạy lại initial schema.
2. Đặt `PAYMENT_DEMO_ENABLED=true` ở backend và chạy/deploy mã mới. Tên biến cũ được giữ để tương thích cấu hình; mặc định là `false`.
3. Website khách hàng trỏ `PHUB_API_BASE_URL` tới backend mới. Backend trả `payment_bypass_enabled` trong hồ sơ để hiện nút **Thanh toán bypass**.

Local hiện chạy website ở `http://localhost:3000`, API ở `http://127.0.0.1:8000`. Key Supabase và JWT chỉ nằm trong `Backend/.env`, được Git bỏ qua. Render chưa được deploy hoặc thay đổi môi trường trong lần sửa này.

## Luồng dữ liệu

Khách đăng nhập bấm nút tại màn hình đặt hàng thành công hoặc chi tiết đơn. Frontend gửi phương thức và UUID v4 trong `Idempotency-Key` đến `POST /api/orders/{order_id}/payment-request`; không gửi số tiền, người ghi nhận hoặc trạng thái đích.

Backend xác minh phiên, Origin, chủ đơn và tài khoản còn hoạt động. Trong cùng transaction, SQL:

1. Khóa đơn và chi tiết; chỉ nhận đơn ONLINE ở trạng thái MOI, XAC_NHAN hoặc DANG_CHUAN_BI.
2. Tính giá sau giảm giá và thuế từng dòng bằng `numeric`, làm tròn `round(...,2)` theo quy ước lập hóa đơn hiện có.
3. Chưa có hóa đơn thì cập nhật thuế/thành tiền ở `CT_DON_HANG` và tạo `HOA_DON`. Đã có hóa đơn thì kiểm tra khớp các dòng, không tạo lại hoặc đổi người lập cũ.
4. Tính số còn phải thu theo hóa đơn trừ các khoản THU thành công, cộng khoản HOAN_TIEN thành công. Từ chối nếu có giao dịch đang chờ hoặc đơn đã thanh toán đủ.
5. Ghi khoản THU/THANH_CONG vào `THANH_TOAN`, chỉ thu số còn thiếu.
6. Liên kết bản ghi chống trùng với khoản thu, chuyển `DON_HANG.trang_thai` sang DANG_CHUAN_BI.

Lỗi giữa chừng rollback hóa đơn, khoản thu và trạng thái. Gửi lại cùng khóa/nội dung trả kết quả đã ghi, không thu lại. Khóa dùng cho đơn hoặc phương thức khác bị từ chối.

## Dấu vết và các bước tiếp theo

- `THANH_TOAN.la_bypass=true`, mã đối soát tiền tố `BYPASS-`, `ma_tk_ghi_nhan` lưu tài khoản yêu cầu. Đây là khoản thanh toán được ghi nhận trong hệ thống, không phải xác nhận từ cổng thanh toán.
- Hóa đơn tự lập có `nguon_lap=TU_DONG`, `nguoi_lap=NULL`, `ma_tk_lap` lưu tài khoản khởi tạo. Không gán một nhân viên/Admin bất kỳ làm người lập.
- `payment_demo.attempts` là bảng chống trùng/audit với `payment_id` trỏ tới `THANH_TOAN`; dữ liệu thanh toán và hóa đơn đọc từ bảng nghiệp vụ. Tên schema và metadata API `demo` được giữ tương thích, không còn là sổ giao dịch giả tách biệt.
- Đơn có thể tiếp tục xuất kho, hoàn thành, hoàn tiền qua nghiệp vụ bình thường. Bấm bypass không tự xuất kho hoặc hoàn thành đơn. Báo cáo dùng các bản ghi này theo điều kiện ghi nhận hiện có của báo cáo.
- Tắt bypass chặn các yêu cầu bypass mới; dữ liệu đã ghi vẫn hiện trong lịch sử thanh toán, hóa đơn và Admin.
- RPC chỉ cấp quyền thực thi cho `service_role`; trình duyệt không được ghi trực tiếp database.

## Nâng cấp dữ liệu cũ và kiểm tra

Migration mới bỏ các chốt chặn hóa đơn/xuất kho của bản cũ. Lần bypass cũ đã thành công, còn DANG_CHUAN_BI, chưa có hóa đơn/khoản thu, tài khoản hoạt động và số tiền còn khớp sẽ được ghi vào bảng nghiệp vụ. Không tạo đơn mới; không chuyển các đơn đã hủy hoặc đã có bản ghi tài chính.

Đã áp dụng trên Supabase Phub ngày 02/11/2026. Lần bypass cũ được khôi phục thành một hóa đơn và một khoản thu **79.200.000đ**, gồm tiền hàng **72.000.000đ** và thuế **7.200.000đ**; giữ trạng thái DANG_CHUAN_BI.

Kiểm tra tập trung đã qua: SQL PostgreSQL cô lập về tạo hóa đơn/khoản thu, làm tròn, chống trùng, ghi phần còn thiếu, rollback, sửa dữ liệu cũ, xuất kho/hoàn thành/hoàn tiền và quyền RPC; API về chủ đơn, Origin, chế độ tắt và phản hồi lỗi; TypeScript hai giao diện. Không tạo đơn thử hoặc khoản thanh toán thử trên Supabase thật.

# Liên kết hóa đơn mua tại cửa hàng

## Cách sử dụng

1. Khách đã có tài khoản: nhân viên mở `/counter`, tìm đúng tên đăng nhập/mã khách,
   đối chiếu với khách rồi chọn khi tạo đơn tại quầy. Danh sách chỉ gồm tài khoản đang hoạt động.
   Admin cũng chọn tài khoản đang hoạt động trong form tạo đơn hiện tại.
2. Khách đăng ký sau khi mua: mở `/contact-us?invoice_link=1`, nhập mã hóa đơn
   và thông tin mua hàng để đối chiếu. Yêu cầu được lưu vào ticket `PHAN_HOI`, không thêm bảng yêu cầu.
3. Nhân viên mở `/invoice-claims`; Admin mở ticket trong `/support`.
   Đối chiếu chứng từ gốc, ngày mua, số tiền và thông tin liên hệ; ghi chú cách xác minh,
   đánh dấu đã xác minh rồi chấp nhận hoặc từ chối.
4. Khách xem kết quả trong lịch sử hỗ trợ. Chấp nhận gắn `DON_HANG.ma_kh` với khách;
   đơn hoàn thành cho phép đánh giá ngay. Đơn chưa hoàn thành tiếp tục luồng xử lý hiện tại.

Không xác minh chỉ dựa vào trùng tên/SĐT. Không liên kết đơn ONLINE, đơn hủy hoặc đơn đã có chủ;
không chuyển đơn từ khách khác. Tạo yêu cầu không tiết lộ hóa đơn tồn tại hay thông tin người mua.

## Dữ liệu và phân quyền

- Chấp nhận chỉ cập nhật chủ đơn và kết quả ticket; giữ nguyên hóa đơn, dòng hàng,
  số tiền, thanh toán, trạng thái đơn và tồn kho.
- Lưu phiên bản, kết quả, tài khoản xác minh, thời điểm và ghi chú nội bộ.
  Phản hồi khách được thêm vào lịch sử; API khách không trả ghi chú nội bộ.
- Transaction khóa đơn và kiểm tra lại tài khoản, chủ đơn, trạng thái, phiên bản hóa đơn.
  Hai yêu cầu cùng hóa đơn không thể cùng được chấp nhận.
- API ghi kiểm tra Origin và `Idempotency-Key` UUID v4. Gửi lại cùng nội dung dùng cùng mã;
  nội dung khác dùng lại mã trả lỗi. UI chỉ báo thành công khi backend xác nhận thành công.
- Nhân viên tạo đơn qua transaction có sẵn, được chọn hàng từ mọi kho đang hoạt động.
  Migration `20261112045449_counter_orders_all_active_warehouses.sql` đồng bộ phạm vi
  tra cứu và tạo đơn; vẫn kiểm tra quyền nhân viên, kho hoạt động, giá và tồn khả dụng.
  Tạo đơn không tự lập hóa đơn/thu tiền/xuất hàng/hoàn thành. Quyền quản trị khác giữ nguyên.

## API

| Vai trò | Endpoint |
| --- | --- |
| Khách | POST `/api/customer/crm/invoice-claims` |
| Nhân viên/Admin | GET `/api/staff/invoice-claims?page=1` |
| Nhân viên/Admin | GET `/api/staff/invoice-claims/{ticket_id}` |
| Nhân viên/Admin | POST `/api/staff/invoice-claims/{ticket_id}/decision` |
| Nhân viên/Admin | GET `/api/staff/counter/customers?q=...` |
| Nhân viên/Admin | GET `/api/staff/counter/products?q=...` |
| Nhân viên/Admin | POST `/api/staff/counter/orders` |

DTO tại `Backend/phub_api/schemas/invoice_claims.py` và `schemas/admin_operations.py`;
OpenAPI đã cập nhật. RPC chỉ cấp quyền gọi cho backend `service_role`, kiểm tra lại vai trò tại DB.

## Triển khai và kiểm tra

- Migration `20261106083600_counter_invoice_claims.sql` đã áp dụng trên Supabase Phub.
  Không tạo/liên kết giao dịch thật để thử; không chạy lại migration trên project này.
- Deploy backend và ba UI: User, Admin, Warehouse. Demo nhiều vai trò bằng browser profile
  hoặc cửa sổ riêng tư khác nhau để tránh dùng chung cookie localhost.
- Đã qua SQL PGlite biệt lập: ownership, gửi lại, phiên bản, audit, bất biến hóa đơn/tồn kho,
  điều kiện đánh giá và quyền/kho bán tại quầy (`Backend/tests/invoice-claims-sql.test.cjs`).
- Đã qua 40 kiểm tra HTTP/RPC tập trung cho liên kết hóa đơn và hỗ trợ;
  TypeScript Admin/User/Warehouse, kiểm tra OpenAPI. Không chạy toàn bộ test/build.
- Chưa kiểm tra toàn bộ thao tác giao diện bằng trình duyệt hoặc nghiệm thu trên Render.
- Security advisors sau migration không phát sinh cảnh báo mới.

# Review admin — 28/10/2026

Phần admin mới được phát triển từ main `a96294f`, chuẩn bị trên nhánh
`feat/backend-middleware-api`; backend/UI mới chưa deploy Render.
Đã áp dụng migration `admin_operations` trên Supabase ngày
28/10/2026; backend local đã gọi thành công RPC thống kê qua Supabase client.

## Kết quả đã xác nhận

- 1.038 pytest đạt trên bản xuất mã sạch, bao gồm kiểm tra kiến trúc 3 lớp.
- 84 test Node admin/gateway đạt. TypeScript và production build đạt.
- PostgreSQL thật, database test riêng: nhập/chuyển/xuất kho, hóa đơn, thu/hoàn,
  kiểm kê, idempotency, rollback, voucher không tái dùng sau hủy, RLS/quyền và
  hội thoại ticket. Hai yêu cầu đồng thời không bán/hoàn vượt giới hạn.
- Luồng SQL chạy đạt với cả timestamp và timestamptz của đơn hàng, bao gồm
  kiểm tra ranh giới ngày Việt Nam. Đã đối chiếu cột Supabase bằng SELECT.
- Browser: thao tác đơn, phục hồi retry sau refresh với cùng key/body, tạo phiếu
  mã số âm, kiểm kê, lọc, tìm kiếm, dashboard, hỗ trợ và bố cục mobile đã chạy.
  Browser dùng API intercept; không ghi dữ liệu cloud.

## Các lỗi tìm thấy và đã sửa

1. Số lượng tồn và tiền có thể bị ghi lặp nếu retry: dùng transaction + key theo
   tài khoản, khóa dòng và giữ nguyên yêu cầu đang dở trong sessionStorage.
2. Kiểm kê gửi record_id rỗng: đổi sang null, dữ liệu kho/SKU tách riêng.
3. API cũ bỏ qua filter: yêu cầu xác nhận filter; không cho sửa dòng sai phiếu.
4. Form mã sản phẩm/SKU có thể chọn bản ghi cũ: chỉ dùng dropdown cho khóa ngoại.
5. Tồn khả dụng: loại phần đang giữ cho đơn khỏi hàng có thể chuyển/kiểm kê giảm.
6. Múi giờ database thật khác DBML: RPC cố định UTC và đọc timestamp/timestamptz
   theo cùng quy ước; không chuyển múi giờ hai lần khi thống kê.
7. Header mobile bị tràn: tìm kiếm thu gọn và mở ô tìm kiếm riêng trên mobile.
8. Bộ lọc đóng vẫn tải lựa chọn: chỉ tải khi mở, giảm request không cần thiết.
9. Hóa đơn đơn hủy: giữ để đối chiếu, loại khỏi báo cáo, xác nhận trạng thái mới
   khi in và hiển thị dấu đã hủy. Chỉ in khi tải đủ dòng hàng đúng đơn.

## Giới hạn và việc triển khai còn lại

- Đã cài migration `20261028132157_admin_operations.sql` trên Supabase. Các API đọc
  và thử ghi/replay trong transaction rollback đều đạt; số đơn, tồn kho và giao dịch
  hiện có không thay đổi. Backend/UI mới vẫn cần deploy để dùng trên Render.
- Thu/hoàn tiền là ghi nhận thủ công; chưa chuyển tiền thực, chưa nối webhook
  ngân hàng hay phát hành hóa đơn điện tử pháp lý.
- API hội thoại khách đã có; giao diện khách nhiều lượt chưa tích hợp trong
  đợt admin này. Khách vẫn xem được phản hồi quản trị gần nhất qua API hiện có.
- Thông báo là danh sách khi mở/làm mới, không phải push/email.
- Sổ kho bắt đầu ghi từ lúc cài migration, không dựng lại lịch sử cũ.
- Công cụ chặn dọn cache local; kiểm tra kiến trúc đầy đủ được chạy trên bản
  xuất mã sạch, không thay đổi dữ liệu người dùng để làm test đạt.

Hợp đồng và hướng dẫn: [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md).

Đã đồng bộ role `NHAN_VIEN` giữa backend/UI và Supabase. Khi khôi phục yêu cầu
kiểm kê, khóa lưu gắn với cả kho và SKU và kiểm tra lại nội dung. Xuất CSV bị khóa
khi thống kê đang tải hoặc lỗi để tránh tải báo cáo từ kỳ cũ.

## Phạm vi một kho — cập nhật 28/10/2026

- Đã bỏ menu chuyển kho trên admin/kho, form tạo/xử lý và API sửa phiếu chuyển.
- API vận hành/gateway không nhận lệnh chuyển kho. Migration
  `20261028154622_disable_transfers_single_warehouse.sql` đã cài trên Supabase;
  RPC từ chối create/lines/dispatch/receive/cancel trước khi ghi dữ liệu.
- Giữ 4 phiếu chuyển cũ ở chế độ tra cứu; tổng tồn kho không thay đổi.
- 303 test backend liên quan, 16 test gateway và TypeScript admin/kho đạt.

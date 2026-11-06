# Xóa mềm khách hàng và tính tuổi — 05/11/2026

- Admin có nút **Xóa mềm / Khôi phục** ở danh sách và chi tiết khách hàng.
- Danh sách mặc định chỉ hiện hồ sơ đang sử dụng; bộ lọc hỗ trợ đã xóa mềm/tất cả.
- Xóa mềm không xóa khách, đơn hàng, hóa đơn, thanh toán hoặc phản hồi và không hủy đơn đang xử lý.
- Một RPC kiểm tra lại ADMIN, khóa hồ sơ và ghi `luu_tru_luc`, ẩn tài khoản liên kết,
  đổi `phien_ban_mat_khau` trong cùng transaction. Thử lại trạng thái đã lưu không đổi ngày xóa/phiên thêm lần nữa.
- Khôi phục chỉ bỏ dấu xóa mềm; tài khoản vẫn ẩn. Admin chủ động bật lại nếu phù hợp.
  Phiên trước lúc xóa mềm luôn vô hiệu, kể cả khi bật lại tài khoản sau này.
- Hồ sơ đã xóa mềm chỉ xem lịch sử; API và DB chặn sửa hồ sơ/bật tài khoản trước khi khôi phục.
- Tuổi hiển thị ở bảng/chi tiết Admin và hồ sơ khách, tính từ `KHACH_HANG.ngay_sinh` theo ngày Việt Nam.
  Chưa đến sinh nhật trong năm thì trừ một tuổi; 29/02 tăng tuổi ngày 01/03 ở năm không nhuận.
  Ngày sinh thiếu/không hợp lệ/tương lai không được gán tuổi 0. Không có cột tuổi cố định.
- Khách cập nhật ngày sinh tùy chọn tại hồ sơ cá nhân. API không nhận mã khách do client khai báo,
  không nhận tuổi; bỏ trường birthday trong PUT cũ sẽ giữ nguyên ngày sinh, gửi null để xóa ngày sinh.

Migration: `Backend/migrations/20261105083031_customer_soft_delete.sql`.
Đã áp dụng trên Supabase Phub (`btfhahnjydaiivvcqnna`), cùng version migration remote.
Chỉ bổ sung RPC/trigger trên cấu trúc đang có, không xóa mềm dữ liệu thật khi chạy migration.
Triển khai backend và hai UI cùng thay đổi gateway `ui/shared/backend-route.ts`.
Local đã dùng backend mới ở 8000, Admin 3001 và User 3000; chưa deploy mã lên Render.
Kiểm tra chỉ đọc sau migration: 18 hồ sơ, không hồ sơ nào bị xóa mềm trong quá trình triển khai;
chưa có hồ sơ điền ngày sinh. Không tự tạo ngày sinh để làm đầy dữ liệu.

Advisors sau migration không có cảnh báo mới cho chức năng này. Các cảnh báo có sẵn
về `public.rls_auto_enable()` nằm ngoài phạm vi sửa: [quyền gọi hàm SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

API mới: `POST /api/crm/customers/{customer_id}/archive` với `{ "archived": true|false }`.
Danh sách dùng bộ lọc `luu_tru_luc: ACTIVE|ARCHIVED|ALL`; đọc bằng key vẫn xem được hồ sơ lưu trữ.
`GET/PUT /api/customer/me` có `birthday` dạng `YYYY-MM-DD|null`.

Kiểm tra có mục tiêu: PostgreSQL PGlite biệt lập (transaction, retry, giữ lịch sử, phân quyền,
khôi phục và chặn kích hoạt), API mocked (quyền/Origin/validation), trình duyệt fixtures
cho danh sách/chi tiết/ngày sinh. Không xóa mềm hay sửa ngày sinh khách thật để kiểm thử.

# Xóa mềm tài khoản trong Admin

- Admin có **Xóa mềm / Khôi phục** trên danh sách và chi tiết tài khoản.
- Danh sách mặc định **Chưa xóa**; đổi bộ lọc sang **Đã xóa mềm** hoặc **Tất cả tài khoản** để xem lại.
- Xóa mềm lưu `TAI_KHOAN.luu_tru_luc`, `luu_tru_boi`, đưa trạng thái về 0 và đổi
  `phien_ban_mat_khau` trong cùng transaction. Phiên cũ không thể dùng lại sau khôi phục.
- Chặn tự xóa tài khoản đang đăng nhập. Chỉ ADMIN được gọi API này; SQL RPC
  kiểm tra lại actor đang hoạt động và khóa actor/target theo thứ tự ổn định.
- Khôi phục bỏ dấu xóa mềm; tài khoản vẫn ẩn. Admin kiểm tra hồ sơ rồi chọn
  **Hoạt động** nếu muốn cho đăng nhập lại. Hồ sơ khách bị lưu trữ phải khôi phục riêng trước.
- Tài khoản đã xóa chỉ xem, không sửa thông tin, mật khẩu, quyền hoặc trạng thái.
- Không xóa hồ sơ nhân viên/khách hàng, đơn, hóa đơn, đánh giá hay lịch sử liên quan.
  Không giải phóng tên đăng nhập/email; dùng khôi phục thay vì tạo tài khoản trùng.
- Xóa mềm tài khoản và xóa mềm hồ sơ khách là hai thao tác độc lập.

API: `POST /api/admin/accounts/{account_id}/archive`, JSON `{ "archived": true|false }`.
Danh sách: `GET /api/admin/accounts?archive=ACTIVE|ARCHIVED|ALL`.
Các endpoint đều yêu cầu phiên ADMIN; thao tác ghi yêu cầu Origin hợp lệ.

Áp dụng migration `Backend/migrations/20261109065207_account_soft_delete.sql`
trước khi chạy backend mới. Migration chỉ thêm cột, constraint, index, trigger và RPC;
không xóa hoặc tự đổi trạng thái bất kỳ tài khoản đang có nào.

Đã áp dụng trên Supabase Phub ngày 09/11/2026, version `20261109065207`.
Kiểm tra chỉ đọc sau migration: 28 tài khoản, 0 tài khoản đã xóa mềm; anon/authenticated
không có quyền gọi RPC, chỉ server service_role được gọi.

Kiểm tra có mục tiêu: SQL biệt lập (quyền, lịch sử, phiên, retry/restore), API mocked
(phân quyền/Origin, validation, bộ lọc, chặn sửa, lỗi), TypeScript và browser fixtures.
Không xóa thử tài khoản thật để kiểm tra chức năng.

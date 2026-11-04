# Hướng dẫn cho AI làm việc trong PHUB

Trước khi sửa luồng mua hàng khách hàng, đọc
[logic mua hàng và bàn giao cho AI](docs/USER-COMMERCE-LOGIC.md).
Tài liệu ghi các quyết định đã chốt ngày 02/11/2026, vị trí mã và cách kiểm thử.
Đối chiếu mã hiện tại và yêu cầu mới của người dùng khi tiếp tục thay đổi.

- Checkout khách hàng gom tồn khả dụng từ tất cả kho hoạt động. Không khôi phục
  giới hạn một kho, kho cố định hoặc trần số lượng 99/1.000.
- Trừ phần hàng được giữ bởi đơn `MOI`, `XAC_NHAN`, `DANG_CHUAN_BI`
  đã có hóa đơn hoặc khoản thu thành công. Thêm giỏ/xem báo giá không giữ hàng.
  Kiểm tra ở trang sản phẩm, nút tiếp tục tại `/cart` và transaction tạo đơn.
- Dòng `CT_DON_HANG` vẫn tách theo kho để giữ/xuất hàng. Chỉ gộp cách hiển thị
  sản phẩm cùng SKU, đơn vị và đơn giá bằng `groupInvoiceLines`.
- `/main/profile` hiển thị danh sách đơn và dẫn đến `/main/orders/[id]`.
  Kiểm tra chi tiết đơn, hóa đơn tại đó và hóa đơn sau checkout.
- Hóa đơn mới được tạo cùng transaction đặt hàng; lỗi thì rollback toàn bộ.
  Có hóa đơn không đồng nghĩa đã thanh toán. Giữ idempotency và ownership.
- Hết tồn khả dụng thì ẩn nút thêm giỏ/mua ngay và hiện `Hết hàng`.
  Lỗi API hoặc nhập vượt tồn cần thông báo riêng.
- Dữ liệu và các con số trong ví dụ là lịch sử kiểm thử. Đọc trạng thái hiện tại
  trước khi kết luận; không dùng việc hủy đơn, xóa thanh toán hoặc sửa tồn như
  một cách sửa lỗi giao diện. Mọi thay đổi dữ liệu phải nằm trong yêu cầu của người dùng.
- Giữ thay đổi đang có trong worktree. Tách kết quả kiểm thử bằng fixtures,
  PostgreSQL biệt lập và dữ liệu đang chạy khi báo cáo.

Backend tuân theo [kiến trúc ba lớp](Backend/ARCHITECTURE.md).
Khi sửa user UI, đọc thêm [hướng dẫn Next.js tại frontend](ui/userUI/Frontend/AGENTS.md).

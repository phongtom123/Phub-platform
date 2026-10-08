# Sequence diagram đầy đủ phía khách hàng — PHUB

Mở file [user-sequence-diagrams-v2.drawio](./user-sequence-diagrams-v2.drawio) bằng diagrams.net hoặc draw.io Desktop.

Đây là bộ **sequence diagram**, thể hiện actor, lifeline và message giữa User UI, API, Supabase Database và các dịch vụ ngoài.

File gồm 7 trang:

1. Xác thực: đăng nhập, đăng ký, quên mật khẩu và đăng xuất.
2. Tìm kiếm, lọc và xem chi tiết sản phẩm.
3. Giỏ hàng và voucher.
4. Checkout và thanh toán.
5. Danh sách đơn, hủy đơn, hoàn tiền và thanh toán lại.
6. Hồ sơ, địa chỉ, đổi mật khẩu và đăng xuất.
7. Wishlist, compare, liên hệ và newsletter.

Các tên trạng thái đơn hàng, thanh toán và phương thức thanh toán đã được đồng bộ với schema Supabase hiện tại. Các ghi chú màu vàng đánh dấu phần chưa có bảng hoặc cần quyết định nghiệp vụ.


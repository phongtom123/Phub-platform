# Tài khoản khách hàng

Cập nhật 05/11/2026: hồ sơ có ngày sinh tùy chọn và tuổi được tính khi hiển thị.
Sidebar giữ nguyên khi mở khảo sát được gửi hoặc đánh giá sản phẩm đã mua.
Hai mục này hiển thị trong dashboard; URL cũ `/main/surveys` và `/main/reviews`
chuyển đến `/main/profile?view=surveys` và `?view=reviews`. Xem `docs/CRM-SURVEYS-REVIEWS.md`
tại gốc repository để biết quy trình, API và phân quyền.

Route `/main/profile`, dành cho tài khoản `KHACH_HANG` đã đăng nhập.

Trang hiển thị các mục đã kết nối:

- **Thông tin cá nhân:** tên, tên đăng nhập, điện thoại, ảnh đại diện và chỉnh sửa hồ sơ.
- **Địa chỉ giao hàng:** sổ địa chỉ tối đa 10 mục; thêm, sửa, xóa và đặt mặc định. Không sửa địa chỉ của đơn đã đặt.
- **Đơn hàng của tôi:** danh sách có phân trang, trạng thái bằng tiếng Việt và liên kết đến `/main/orders/{id}`. Trang chi tiết riêng hiển thị hóa đơn và thanh toán.
- **Khảo sát của tôi:** danh sách khảo sát được gửi và form trả lời, giữ menu tài khoản bên trái.
- **Đánh giá sản phẩm:** các sản phẩm đủ điều kiện, viết hoặc sửa đánh giá ngay bên cạnh menu tài khoản.

Không hiển thị các mục tải xuống, phương thức thanh toán đã lưu, thỏa thuận thanh toán, đăng ký bản tin, so sánh và wishlist chưa được kết nối.

`AccountDashboard` quản lý giao diện và hồ sơ. Ngay mục thông tin tài khoản,
`AccountOrders recent` tải tối đa **5 đơn gần nhất**, mới nhất trước; không tải
toàn bộ lịch sử vào RAM. Mục Đơn hàng của tôi vẫn phân trang 10 đơn/trang.
Ô đơn gần đây chỉ để xem tóm tắt và mở chi tiết. Nút **Hủy đơn hàng** màu đỏ
có ở từng đơn MOI/XAC_NHAN/DANG_CHUAN_BI trong danh sách đầy đủ và trang chi tiết;
xác nhận trước khi ghi, không tự thử lại POST.
Lỗi giữ nguyên đơn và hiện ngay tại nút. Đơn đã xuất kho/hoàn thành/đã hủy
không có nút hủy. Đơn đã thu tiền thực tế cần cửa hàng xác nhận hoàn tiền trước.
`AccountEditor` lưu hồ sơ qua API và giữ khả năng tải ảnh đại diện.
`AccountPanels` chứa khung, trạng thái và phân trang dùng chung.

`AccountAddresses` dùng chung API sổ địa chỉ với checkout. Trang tổng quan tài khoản
hiện địa chỉ mặc định lấy từ sổ địa chỉ, gồm đúng tên và điện thoại người nhận.
Khi xóa địa chỉ mặc định, hiển thị lại địa chỉ được server chọn thay thế.

Dữ liệu đi qua gateway hiện có bằng cookie phiên:

| Tác vụ | Endpoint backend |
| --- | --- |
| Phiên / đăng xuất | `GET /api/auth/me`, `POST /api/auth/logout` |
| Xem / lưu hồ sơ | `GET /api/customer/me`, `PUT /api/customer/me` |
| Ảnh đại diện | `POST /api/customer/me/avatar` |
| Sổ địa chỉ | `GET /api/customer/addresses`, `POST /api/customer/addresses` |
| Sửa / đặt mặc định | `PUT /api/customer/addresses/{id}` |
| Xóa địa chỉ | `POST /api/customer/addresses/{id}/delete` |
| Danh sách đơn | `GET /api/customer/orders?page=…&page_size=10` |
| Đơn gần đây | `GET /api/customer/orders?page=1&page_size=5` |
| Hủy đơn | `POST /api/customer/orders/{id}/cancel` |

Không dùng dữ liệu mẫu khi API lỗi. Phiên hết hạn hoặc không đúng vai trò sẽ ẩn dữ liệu tài khoản. Không suy diễn tên đăng nhập là email.

Kiểm tra từ `ui/userUI/Frontend`, với server local ở cổng 3001:

```sh
npx tsc --noEmit
node --test tests/account-client.test.cjs
node tests/account-dashboard.e2e.cjs
node tests/recent-orders.e2e.cjs
node tests/account-addresses.e2e.cjs
```

E2E dùng HTTP fixtures, không ghi dữ liệu thật. Có thể đặt `PHUB_USER_TEST_URL`, `PHUB_PLAYWRIGHT_MODULE` và `PHUB_CHROMIUM_PATH` theo môi trường.

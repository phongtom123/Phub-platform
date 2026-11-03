# Tài khoản khách hàng

Route `/main/profile`, dành cho tài khoản `KHACH_HANG` đã đăng nhập.

Trang chỉ hiển thị ba mục có chức năng hoạt động:

- **Thông tin cá nhân:** tên, tên đăng nhập, điện thoại, ảnh đại diện và chỉnh sửa hồ sơ.
- **Địa chỉ giao hàng:** sổ địa chỉ tối đa 10 mục; thêm, sửa, xóa và đặt mặc định. Không sửa địa chỉ của đơn đã đặt.
- **Đơn hàng của tôi:** danh sách có phân trang, trạng thái bằng tiếng Việt và liên kết đến `/main/orders/{id}`. Trang chi tiết riêng hiển thị hóa đơn và thanh toán.

Không hiển thị các mục tải xuống, phương thức thanh toán đã lưu, thỏa thuận thanh toán, đánh giá, đăng ký bản tin, so sánh và wishlist chưa được kết nối.

`AccountDashboard` quản lý giao diện và hồ sơ; `AccountOrders` chỉ tải danh sách khi được mở. `AccountEditor` lưu hồ sơ qua API và giữ khả năng tải ảnh đại diện. `AccountPanels` chứa các phần hiển thị trạng thái, khung nội dung và phân trang dùng chung. Không tạo đơn hoặc thanh toán khi xem hồ sơ.

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

Không dùng dữ liệu mẫu khi API lỗi. Phiên hết hạn hoặc không đúng vai trò sẽ ẩn dữ liệu tài khoản. Không suy diễn tên đăng nhập là email.

Kiểm tra từ `ui/userUI/Frontend`, với server local ở cổng 3001:

```sh
npx tsc --noEmit
node --test tests/account-client.test.cjs
node tests/account-dashboard.e2e.cjs
node tests/account-addresses.e2e.cjs
```

E2E dùng HTTP fixtures, không ghi dữ liệu thật. Có thể đặt `PHUB_USER_TEST_URL`, `PHUB_PLAYWRIGHT_MODULE` và `PHUB_CHROMIUM_PATH` theo môi trường.

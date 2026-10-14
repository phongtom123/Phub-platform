# Dashboard tài khoản khách hàng

Route: `/main/profile`. Chỉ tài khoản `KHACH_HANG` đã đăng nhập được tải dữ liệu.
Giao diện dùng gateway `/api/backend/*` và cookie phiên hiện có; không đọc trực tiếp
Supabase, không đưa secret/JWT vào JavaScript và không nhận `customer_id` từ URL.

## Bố cục theo ảnh tham chiếu

Giữ tiêu đề `My Dashboard`, sidebar 327px với 10 mục chia ba nhóm nền `#f5f7ff`,
hai khối `Compare Products` / `My Wish List` và nội dung phẳng, không avatar/thẻ thống kê.
Trang mặc định có `Account Information` (Contact Information / Newsletters) và
`Address Book` (Default Billing Address / Default Shipping Address) theo hai cột.
Mobile xếp lại một cột, giữ đủ chức năng và không tràn ngang.

Tên, username, điện thoại và địa chỉ nhận hàng đọc từ API, không dùng tên/email mẫu.
Không suy diễn username là email hoặc địa chỉ nhận hàng là địa chỉ thanh toán.
Các mục chưa có API hiển thị thông báo đúng trạng thái khi xem/chọn Edit.
Header/footer vẫn dùng dữ liệu chung của storefront, không chép thông tin cửa hàng mẫu.
Trong `My Orders` có các mục Đơn hàng / Hóa đơn / Thanh toán; `Stored Payment Methods`
không bị đánh đồng với lịch sử giao dịch và có liên kết sang My Orders.

## API đã kết nối

| Chức năng | Endpoint backend |
| --- | --- |
| Xác thực phiên / đăng xuất | `GET /api/auth/me`, `POST /api/auth/logout` |
| Hồ sơ, số điện thoại, địa chỉ mặc định | `GET /api/customer/me` |
| Lưu tên và thông tin nhận hàng | `PUT /api/customer/me` |
| Tổng số đơn, danh sách phân trang trong My Orders | `GET /api/customer/orders?page=…&page_size=10` |
| Chi tiết đơn, dòng sản phẩm, người nhận, ghi chú | `GET /api/customer/orders/{id}` |
| Hóa đơn và số tiền đã chốt | `GET /api/customer/orders/{id}/invoice` |
| Giao dịch mới nhất | `GET /api/orders/{id}/payments` |
| Lịch sử thu/hoàn tiền phân trang | `GET /api/orders/{id}/transactions?page=…&page_size=10` |

Danh sách đơn chỉ tải khi mở My Orders. Hóa đơn/thanh toán chỉ được gọi khi khách chọn đơn, không tải tất cả đơn hoặc tạo
N+1 request lúc mở dashboard. Tổng đơn lấy từ `pagination.total`, không dùng số dòng
của trang đầu. Không cộng tổng chi tiêu hay số đã thanh toán từ dữ liệu phân trang.
Giá trị đơn, tổng hóa đơn và số tiền từng giao dịch được hiển thị riêng; không cộng
thuế lại hoặc suy diễn đã tất toán từ giao dịch gần nhất (có thể là hoàn tiền).

Mỗi khối có trạng thái tải, lỗi, thử lại và rỗng riêng. Dữ liệu lỗi không biến thành
con số 0 giả. Khi API trả 401/403, dashboard xóa dữ liệu riêng tư khỏi giao diện.
Request bị hủy khi đổi mục/unmount; dữ liệu hồ sơ và giao dịch không lưu localStorage.

Biểu mẫu chỉ gửi năm trường mà `Recipient` hỗ trợ; chờ PUT thành công rồi đọc lại
hồ sơ. Hủy/Escape không lưu. Không sửa địa chỉ trên đơn đã đặt.

## Giới hạn có chủ đích

Chưa có endpoint khách hàng cho đổi email/mật khẩu, nhiều địa chỉ, newsletter,
đánh giá hoặc wishlist lưu bền vững. Không lấy API quản trị để thay thế.
`payment-request` hiện trả `PAYMENT_INTEGRATION_REQUIRED` ở production, nên dashboard
chỉ đọc giao dịch, không tạo thanh toán/hoàn tiền hoặc tự xác nhận thành công.
API đặt đơn/báo giá thuộc luồng checkout, không gọi khi mở trang tài khoản.

## Kiểm tra

Chạy từ `ui/userUI/Frontend`:

```sh
npm run build
node --test tests/account-client.test.cjs
node tests/account-dashboard.e2e.cjs
```

E2E dùng Playwright và HTTP fixtures chặn tại trình duyệt, không ghi DB thật.
`PHUB_USER_TEST_URL` mặc định `http://localhost:3000`; có thể đặt
`PHUB_PLAYWRIGHT_MODULE` và `PHUB_CHROMIUM_PATH` theo máy.
Bao gồm lưu/hủy/422, đọc lại hồ sơ, phân trang đơn/giao dịch, hóa đơn, pending/refund,
rỗng/503/malformed/retry, 401/403/sai vai trò, đăng xuất và mobile không tràn ngang.

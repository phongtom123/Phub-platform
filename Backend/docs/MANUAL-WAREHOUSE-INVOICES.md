# Lập hóa đơn trực tiếp từ kho

Nhân viên kho được phân công có thể lập hóa đơn cho hàng còn khả dụng trong kho của mình. Backend kiểm tra tồn khả dụng (sau khi trừ lượng hàng đang được giữ cho đơn), khóa các dòng tồn liên quan, tạo đơn hàng và hóa đơn, trừ tồn, đồng thời ghi lịch sử kho trong cùng một transaction.

## API

Các endpoint dùng prefix `/api/warehouse` và yêu cầu nhân viên kho đã đăng nhập:

| Endpoint | Mục đích |
| --- | --- |
| `GET /manual-invoices/options` | Danh sách sản phẩm đang kinh doanh còn tồn khả dụng trong kho được phân công |
| `GET /manual-invoices/customers?q=...` | Tìm tối đa 10 khách hàng đang hoạt động theo một phần email; cần ít nhất 2 ký tự |
| `POST /manual-invoices` | Tạo hóa đơn từ thông tin khách hàng và các dòng hàng |

Request tạo hóa đơn cần header `Idempotency-Key` là UUID v4. Khi không rõ kết quả của request, gửi lại cùng key và cùng nội dung; dùng key đó với nội dung khác sẽ bị từ chối. Giá, giảm giá và tổng tiền được kiểm tra ở backend. Hóa đơn thủ công được ghi lịch sử với lý do `invoices:manual` và tham chiếu tới mã hóa đơn.

## Triển khai

Áp dụng [migration `20261110174500_manual_warehouse_invoices.sql`](../migrations/20261110174500_manual_warehouse_invoices.sql) sau các migration kho đang dùng. Migration thêm email người mua vào `HOA_DON` và các RPC chỉ cho phép `service_role`; không cấp quyền gọi trực tiếp cho browser hoặc vai trò `anon`/`authenticated`.

Giao diện lập hóa đơn nằm trong **Kho · Hóa đơn**. Lịch sử kho có bộ lọc thời gian và liên kết các biến động do hóa đơn thủ công tới hóa đơn tương ứng.

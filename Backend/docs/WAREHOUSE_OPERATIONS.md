# Nhập hàng dành cho nhân viên kho

UI kho dùng `/api/backend/warehouse/*` của Next.js; gateway gọi API Python `/api/warehouse/*`.
Hai cổng nhân sự dùng chung backend. Đăng nhập bằng role `NHAN_VIEN`, có nhân viên/kho đang hoạt động.
Kho và người thực hiện được lấy lại từ database trong transaction, không nhận từ body của trình duyệt.

| Endpoint | Chức năng |
| --- | --- |
| GET `/api/warehouse/receipts` | Danh sách phiếu trong kho được phân công; tìm mã/nhà cung cấp, lọc trạng thái, phân trang |
| POST `/api/warehouse/receipts` | Tạo phiếu nháp và các dòng hàng |
| GET `/api/warehouse/receipts/{id}` | Header, các dòng hàng và `version` của phiếu |
| PATCH `/api/warehouse/receipts/{id}` | Thay nhà cung cấp, ghi chú và các dòng của phiếu nháp |
| POST `/api/warehouse/receipts/{id}/confirm` | Xác nhận nhập, cộng tồn và ghi lịch sử nguyên tử |
| POST `/api/warehouse/receipts/{id}/cancel` | Hủy phiếu nháp; không đổi tồn |
| GET `/api/warehouse/history` | Lịch sử tồn trong kho, tìm SKU/tên/tham chiếu và lọc ngày Việt Nam |

Các API ghi yêu cầu `Origin` được phép và `Idempotency-Key` là UUID v4. Cùng khóa/nội dung trả lại kết quả đã ghi;
cùng khóa nhưng nội dung khác trả 409. UI giữ khóa khi thử lại một yêu cầu chưa rõ kết quả, không tự gửi lại thao tác ghi.

Tạo phiếu nhận `supplier_id`, `note`, `lines: [{sku, quantity, unit_price}]`. Giá nhập là số thập phân dạng chuỗi,
tối đa hai chữ số sau dấu chấm; không dùng số thực JavaScript để cộng tiền. Không nhận `warehouse_id`, `actor` hoặc trạng thái từ client.
Sửa phiếu nhận thêm `expected_version`; xác nhận/hủy chỉ nhận `{ "expected_version": "<version từ GET chi tiết>" }`.
Phiếu bị người khác sửa trả 409; tải lại trước khi tiếp tục. Phiếu đã nhập/hủy không được sửa hoặc xác nhận lại bằng yêu cầu mới.

RPC khóa hàng phiếu trước khi đổi trạng thái. Cơ chế này phối hợp với API admin hiện có để admin và nhân viên
không cộng tồn hai lần. Dòng hàng được cập nhật trong cùng transaction với header; lỗi bất kỳ dòng nào sẽ rollback.
Trigger `admin_ops.stock_audit` ghi số lượng trước/sau, tài khoản thao tác và mã phiếu.

## Migration

Áp dụng [20261029162141_warehouse_receipts.sql](../migrations/20261029162141_warehouse_receipts.sql)
sau `admin_operations`. Migration thêm hai helper riêng trong `admin_ops` và hai RPC public chỉ `service_role` được gọi.
Không thay đổi số lượng tồn, phiếu hoặc tài khoản hiện có khi cài đặt. Lịch sử cũ trước khi có trigger audit không được tự dựng lại.

## UI và kiểm thử

- `/receipts`: danh sách, tìm kiếm, trạng thái và nút tạo.
- `/receipts/new`: chọn nhà cung cấp/sản phẩm đang hoạt động, nhập số lượng và giá nhập.
- `/receipts/{id}`, `/receipts/{id}/edit`: xem/chỉnh sửa phiếu; xác nhận nhập và hủy nháp.
- `/history`: lịch sử thực từ audit. `/suppliers`: tạo/sửa nhà cung cấp bằng API dữ liệu nền sẵn có.
- Link dữ liệu phiếu cũ được chuyển sang các trang mới.

Test API: `python -m pytest tests/test_warehouse.py -q`.
Test PostgreSQL độc lập: đặt `PHUB_PG_MODULE` trỏ tới module `pg`, chạy `node Backend/scripts/test_warehouse_receipts.cjs`
từ gốc repo. Script chỉ kết nối `127.0.0.1`, tạo database test riêng rồi xóa database test; không nhận URL database cloud.

Kiểm kê, hồ sơ/mật khẩu cá nhân và cài đặt kho nằm ngoài luồng nhập hàng này. Chuyển kho và xuất kho thủ công tiếp tục được tắt.

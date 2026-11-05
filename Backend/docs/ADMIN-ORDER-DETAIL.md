# API tổng hợp chi tiết đơn cho Admin

`GET /api/admin/orders/{order_id}/detail`

Yêu cầu phiên đăng nhập hoặc Bearer token của ADMIN. Gateway Admin:
`GET /api/backend/admin/orders/{order_id}/detail`.

Một HTTP request từ UI nhận toàn bộ dữ liệu đơn:

- `order_id`, `order`: thông tin đơn, trạng thái và địa chỉ đã chốt.
- `customer`: mã, tên và số điện thoại khách; null với đơn khách vãng lai hoặc thiếu hồ sơ.
- `employee`: mã và tên nhân viên phụ trách; không trả lương, CCCD hoặc tài khoản.
- `lines`: các dòng CT_DON_HANG, giữ nguyên SKU và kho xuất; dùng tên/giá tại lúc bán.
- `invoice`: hóa đơn đã lập hoặc null.
- `payments`: toàn bộ giao dịch, bao gồm chờ xử lý và thất bại để đối chiếu.
- `voucher_uses`: các lượt voucher thuộc đúng đơn.
- `history`: thao tác Admin thành công đã được sổ chống trùng `admin_ops.requests`
  ghi nhận cho đúng đơn. Mỗi mục chỉ trả khóa sự kiện, tài khoản/tên người thực
  hiện, thời điểm, thao tác và trạng thái trước/sau; không trả hash hay payload
  kết quả của lệnh.
- `financial`: tổng tiền và trạng thái được backend tính, ví dụ:

```json
{
  "invoice_id": "HD1",
  "invoice_status": "DA_LAP",
  "payment_status": "THU_MOT_PHAN",
  "total": "1000.30",
  "collected": "200.10",
  "refunded": "50.05",
  "paid": "150.05",
  "remaining": "850.25"
}
```

Tiền dạng chuỗi thập phân, không làm tròn qua float. `total` lấy từ tổng hóa đơn
sau thuế. Chỉ tính giao dịch THANH_CONG: collected là tổng THU, refunded là tổng
HOAN_TIEN, paid = collected − refunded, remaining = max(0, total − paid).
Chưa có hóa đơn thì total và remaining là null; không suy diễn đã thanh toán đủ.
Trạng thái hóa đơn: DA_LAP / CHUA_LAP. Trạng thái thanh toán: CHUA_CO_HOA_DON /
CHUA_THU / THU_MOT_PHAN / DA_THU_DU / THU_THUA. Đây là trạng thái dẫn xuất,
không tự sửa trạng thái đơn, hóa đơn hay giao dịch.

Trả 401 khi chưa đăng nhập, 403 với role khác, 404 khi không thấy đơn,
409 khi lịch sử thiếu/trùng, số tiền sai hoặc số dòng thay đổi khi phân trang,
503 khi không truy cập được database. Không trả số tổng hợp thành công giả khi đọc lỗi.
Đọc tối đa 100.000 dòng mỗi loại; vượt ngưỡng báo lỗi rõ, không cắt bớt kết quả.
Response thành công có Cache-Control: no-store. Không có thao tác ghi dữ liệu.

Đây là một HTTP API tổng hợp; bên trong vẫn đọc nhiều truy vấn đã lọc theo đơn.
Chưa phải snapshot database trong một transaction. Kiểm tra phân trang phát hiện
thay đổi số dòng/trùng khóa, không đảm bảo phát hiện mọi cập nhật đồng thời giữ
nguyên số dòng. Giao dịch thu tiền/xuất kho vẫn kiểm tra lại tại transaction hiện có.
Lịch sử xử lý đọc qua RPC service-only `admin_order_history_v1`. Chỉ lệnh có
`result` (transaction đã thành công) được hiển thị; lần retry cùng idempotency key
không sinh thêm sự kiện. Trạng thái trước chỉ được điền với chuyển trạng thái có
nguồn bắt buộc rõ trong transaction. Riêng hủy có thể bắt đầu từ nhiều trạng thái
nên `from_status` là null thay vì suy đoán. Các thao tác trước khi bảng audit được
cài đặt không được dựng lại giả từ trạng thái hiện tại.

Trang Chi tiết đơn dùng kết quả này cho thông tin đơn, tên khách/nhân viên,
khối tiền, bảng sản phẩm theo kho, hóa đơn, lịch sử thu/hoàn và lịch sử xử lý;
không gọi riêng từng bảng khi mở đơn. Auth và metadata màn hình vẫn có request
riêng. Khi mở form thu tiền, form vẫn đọc lại số dư để đối chiếu trước khi ghi.

Áp dụng migration `20261104100000_admin_order_history.sql` cùng phiên bản backend.

Kiểm thử offline: `python -m pytest tests/test_admin_order_detail.py tests/test_architecture.py -q`.
Kiểm thử quyền và projection của RPC trên PostgreSQL RAM:
`node tests/admin-order-history-sql.test.cjs` (có thể đặt `PHUB_PGLITE_MODULE`
trỏ tới bản `@electric-sql/pglite` cài trong thư mục công cụ riêng).
Kiểm thử UI: `node tests/order-financial-summary.e2e.cjs` và
`node tests/order-navigation.e2e.cjs` với PHUB_ADMIN_TEST_URL trỏ đến Admin local.
Các test dùng MockTransport/HTTP fixtures, không ghi dữ liệu thật.

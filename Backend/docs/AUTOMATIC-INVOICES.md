# Hóa đơn tự động sau khi đặt hàng

Customer checkout hiện gọi `customer_checkout_multi_warehouse_v1`, kế thừa phần
lập hóa đơn của `customer_checkout_v2` qua migration
`20261102140733_multi_warehouse_customer_checkout.sql`. Các dòng xuất theo kho
được gộp khi hiển thị đơn/hóa đơn khách hàng. Xem
[logic mua hàng và hướng dẫn cho AI](../../docs/USER-COMMERCE-LOGIC.md).

Migration `20261102080347_automatic_checkout_invoice.sql` nối việc lập hóa đơn vào
transaction `customer_checkout_v2`. Đơn online mới có hóa đơn ngay khi đặt thành công,
không cần xác nhận/lập thủ công ở admin. Nếu lập hóa đơn lỗi, đơn hàng, dòng hàng,
lượt voucher và khóa idempotency cùng rollback. Retry cùng khóa trả nguyên biên nhận
đã lưu và không tạo thêm hóa đơn.

Tiền thuế được làm tròn từng dòng bằng PostgreSQL numeric, sau khi trừ giảm dòng và
voucher. Dòng đơn và tổng hóa đơn được chốt cùng lúc. Hóa đơn có `nguon_lap=TU_DONG`
và `nguoi_lap=NULL`; hóa đơn quản trị vẫn bắt buộc có nhân viên lập. Đơn vẫn ở `MOI`,
chưa ghi nhận thu tiền. Migration không lập bù hoặc sửa các đơn/hóa đơn cũ.

Quote và receipt đặt hàng giữ số tiền trước thuế để giữ nguyên hợp đồng checkout,
bao gồm kiểm tra `expected_total` và replay. Giao diện thành công tự tải hóa đơn
ngay dưới biên nhận để hiển thị tổng sau thuế chính thức. Hai mục xem hóa đơn phía
khách cập nhật nền mỗi 5 giây, khi quay lại tab hoặc kết nối mạng lại; dữ liệu cũ
được giữ khi lỗi mạng tạm thời và xóa khi mất quyền truy cập.

Kiểm tra trên PostgreSQL biệt lập, không đọc `.env` hoặc ghi vào Supabase:

```powershell
python Backend/scripts/test_automatic_checkout_invoice.py
```

Script dùng PostgreSQL trong PATH hoặc `PHUB_POSTGRES_BIN` và `psycopg2`.

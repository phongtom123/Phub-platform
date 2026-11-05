# KAN-61 — Hạn thanh toán hóa đơn 24 giờ

Triển khai ngày 04/11/2026. Phạm vi: đơn ONLINE của khách hàng, có hóa đơn
mới với tổng tiền lớn hơn 0. Hạn tính từ **thời điểm lập hóa đơn + 24 giờ**,
không tính từ lúc thêm giỏ, xem báo giá hoặc mở lại trang.

## Chính sách

- Chỉ áp dụng cho hóa đơn tạo sau khi cài migration. Hóa đơn cũ giữ hạn `NULL`;
  không backfill, không tự hủy đơn lịch sử.
- Hết hạn mà đơn vẫn ở `MOI`, `XAC_NHAN`, `DANG_CHUAN_BI` và chưa có khoản
  `THU / THANH_CONG` dương: chuyển đơn sang `HUY`, ghi thời điểm hủy trên hóa đơn.
- Có khoản thu thành công, kể cả một phần, thì không tự hủy. Khoản thu đã được
  hoàn tiền vẫn là lịch sử thu thành công; việc xử lý tiếp thuộc nghiệp vụ quản lý.
  Thanh toán chờ/thất bại không gia hạn. Đơn xuất kho/hoàn thành không bị hủy.
- Không xóa hóa đơn, giao dịch hay ghi chú khách. Thanh toán đang chờ được đánh
  dấu thất bại; lần dùng voucher chuyển `DA_HUY` theo chính sách hủy hiện có.
  Không xóa lịch sử dùng mã. Quy tắc đếm giới hạn lượt mã vẫn do checkout
  hiện tại quyết định, không sửa trong KAN-61.
- Chuyển `HUY` giải phóng reservation tính từ trạng thái đơn. Tác vụ không cộng,
  trừ hoặc sửa `TON_KHO`, không tự tạo phiếu nhập/xuất.

## Cài đặt và vận hành

Áp dụng lần lượt:

1. `Backend/migrations/20261104071915_unpaid_invoice_deadline_24h.sql`.
2. `Backend/migrations/20261104073822_payment_deadline_read_compatibility.sql`.
3. Chạy `Backend/scripts/install_payment_deadline_cron.sql` bằng quyền quản trị
   database trên Supabase có pg_cron. Lệnh đặt lịch theo tên có thể chạy lại.
4. Deploy backend và user UI cùng thay đổi trong nhánh làm việc này.

Database đã cài cả hai migration và lịch tên
`phub-expire-unpaid-invoices-24h`, chạy mỗi phút, tối đa 200 đơn/lượt.
Việc chặn thu tiền/tiếp tục xử lý có hiệu lực tại đúng hạn trong transaction;
trạng thái hủy và nhả hàng cập nhật ở lượt cron kế tiếp. Khi có backlog trên
200 đơn hoặc scheduler lỗi, việc hủy có thể chậm hơn; không phụ thuộc máy local
hay tiến trình Render luôn chạy.

Hai cột mới duy nhất trong `HOA_DON`:

| Cột | Ý nghĩa |
|---|---|
| `han_thanh_toan` | Hạn thanh toán tuyệt đối, timestamptz |
| `huy_qua_han_luc` | Thời điểm hệ thống đã hủy do quá hạn, timestamptz |

`customer_read_orders_v2` giữ nguyên hợp đồng cho backend Render cũ.
Backend mới dùng `customer_read_orders_v3`; đọc hóa đơn lấy metadata qua RPC
`customer_payment_deadline_v1`, luôn kiểm tra chủ đơn. Metadata chỉ gồm hạn,
thời gian máy chủ và trạng thái. Các RPC mới chỉ cấp quyền `service_role`.

Giao diện có thông báo và đếm ngược ở hóa đơn sau checkout, chi tiết đơn;
danh sách đơn trong hồ sơ có hạn thanh toán dạng gọn. Khi quá hạn, ẩn nút
thanh toán mới. Đồng hồ dựa trên giờ server và thời gian trôi qua, không dựa
vào giờ hệ điều hành của khách. UI đếm mỗi giây trong RAM; không gọi API mỗi
giây. Việc hủy không phụ thuộc việc khách mở trang.

## Kiểm chứng

- `Backend/scripts/test_payment_deadline.cjs`: fixtures SQL biệt lập; hạn UTC
  24 giờ cả khi session dùng giờ Việt Nam, hóa đơn cũ, bảo vệ đơn đã thu tiền,
  quyền sở hữu, rollback, batch, giữ lịch sử, nhả reservation mà không sửa tồn.
- Chạy cùng script trên PostgreSQL 18 biệt lập bằng hai connection: thanh toán
  thắng khóa thì cron bỏ qua; cron thắng thì thanh toán bị từ chối; kiểm tra
  lại giờ sau khi chờ khóa, không dùng thời gian bắt đầu transaction.
- Pytest customer reads/payments/admin operations/OpenAPI/architecture; kiểm tra
  metadata timezone, lỗi 409 và dữ liệu tài chính/ownership hiện có.
  Kết quả cuối: 407 test đạt. TypeScript, ESLint các file thay đổi và các test
  Node về deadline/account client đều đạt.
- Browser fixtures ở 1440px/390px: đếm ngược, hết hạn chặn thanh toán, đổi sang
  đã hủy, không lặp tải đơn, đã thu một phần, hóa đơn cũ, trang hồ sơ.
  Test checkout xác nhận hạn xuất hiện ngay cùng hóa đơn tự động.
- Supabase thật: chỉ cài schema/job và đọc kiểm chứng. Trước/sau có 31 đơn,
  13 hóa đơn, 17 giao dịch, 372 dòng tồn; checksum dữ liệu cũ giữ nguyên.
  Không tạo hoặc thanh toán đơn thật để kiểm thử. Hóa đơn lịch sử có hạn khác
  NULL sau cài đặt: 0.
  Lịch cron đã ghi nhận ba lượt chạy thành công; đọc page/detail/invoice qua
  service backend với dữ liệu thật cũng đạt. Mã backend/UI mới chưa deploy Render.

Kiểm tra lịch và lịch sử chạy bằng quyền quản trị:

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'phub-expire-unpaid-invoices-24h';

select r.status, r.return_message, r.start_time, r.end_time
from cron.job_run_details r join cron.job j using (jobid)
where j.jobname = 'phub-expire-unpaid-invoices-24h'
order by r.start_time desc limit 10;
```

Tạm ngừng lịch (không xóa dữ liệu):

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'phub-expire-unpaid-invoices-24h';
```

Ngừng cron không gỡ chặn thanh toán quá hạn. Không xóa cột/functions khi còn
backend/UI đang sử dụng. Nếu đổi chính sách, cần migration riêng và quyết định
rõ về các hóa đơn đã có hạn.

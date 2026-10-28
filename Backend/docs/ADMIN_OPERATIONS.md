# Vận hành quản trị

Triển khai trên nhánh `feat/backend-middleware-api`, đã đồng bộ main d6d7781. Migration đã cài
trên Supabase ngày 28/10/2026; backend/UI mới chưa deploy Render. Không có API
DELETE hoặc sửa trực tiếp tiền/tồn.

## Cài đặt

1. Sao lưu database; thử migration trên bản test trước.
2. Database cần schema hiện hành (loại SP con, CRM và ticket hỗ trợ).
3. Chạy `Backend/migrations/20261028132157_admin_operations.sql` một lần.
4. Cài `20261028154622_disable_transfers_single_warehouse.sql` để ngừng chuyển kho,
   giữ nguyên dữ liệu phiếu cũ. Deploy backend `phub_api.main:app` và admin UI cùng phiên bản.
5. Không cần thêm biến môi trường hoặc đưa key Supabase vào frontend.

Migration tạo schema riêng `admin_ops`, RPC và trigger sổ biến động tồn kho.
Các bảng mới bật RLS; chỉ `service_role` có quyền, không cấp cho anon/authenticated.
RPC dùng SECURITY INVOKER, xác thực lại tài khoản/nhân viên ADMIN trong database.
Không sửa dữ liệu nghiệp vụ cũ hoặc chạy seed. Sổ kho bắt đầu từ thời điểm cài đặt,
không suy đoán lịch sử trước đó. `Backend/schema.dbml` mô tả bảng nghiệp vụ công khai;
schema nội bộ này được quản lý trong migration.

## API ghi

`POST /api/admin/operations/{resource}` yêu cầu cookie/Bearer ADMIN, Origin hợp lệ,
header `Idempotency-Key` UUID v4. Nội dung:

```json
{"action":"confirm","record_id":"DH-...","expected_status":"MOI","data":{}}
```

`expected_status` chặn thao tác từ giao diện cũ. Mỗi thao tác mới có key mới; retry
sau timeout **giữ nguyên key và body**. Cùng key khác nội dung trả 409. Phản hồi
`{"data":[...],"replayed":false}`; replay không ghi thêm dữ liệu.

| Resource | Action | Dữ liệu |
|---|---|---|
| orders | create | recipient, customer_id tùy chọn, phone/note/voucher_code tùy chọn, lines[{sku,warehouse_id,quantity,unit_price}] |
| orders | assign | employee_id của ADMIN hoạt động |
| orders | confirm, prepare, dispatch, complete, cancel, invoice | {} |
| orders | payment, refund | amount (chuỗi decimal), method, reference (bắt buộc ngoài tiền mặt) |
| receipts | create | warehouse_id, supplier_id, note, lines[{sku,quantity,unit_price}] |
| receipts | lines | lines, thay toàn bộ dòng trong phiếu nháp, tối đa 100 dòng |
| receipts | confirm, cancel | {} |
| inventory | adjust | warehouse_id, sku, expected_quantity, quantity, reason |
| settings | save | store_name, store_address, store_phone, low_stock_threshold |
| notifications | read | ids[] |

Hệ thống chỉ sử dụng một kho. Chuyển kho đã ngừng sử dụng: không có menu, form
hoặc API ghi; RPC từ chối thao tác chuyển kho. Các bảng phiếu cũ chỉ để tra cứu.

Mã kho/NCC/phiếu chấp nhận số nguyên có dấu. Mã phiếu do database tạo, mã đơn/POS
do backend tạo. Dòng phiếu nháp có thể bỏ/thay khi sửa; chứng từ và giao dịch đã chốt
không bị xóa. Các API CRUD cũ vẫn không cho cập nhật trực tiếp chứng từ/tồn/tiền.

## Quy tắc nghiệp vụ

- Đơn: MOI → XAC_NHAN → DANG_CHUAN_BI → DA_XUAT_KHO → HOAN_THANH.
  Chỉ hủy trước xuất kho, khi số tiền thu trừ hoàn bằng 0. Hóa đơn cũ vẫn giữ để
  đối chiếu; báo cáo không tính hóa đơn của đơn hủy. Không có tự hoàn tồn sau xuất.
- Đặt hàng giữ tồn; chỉ xuất kho mới trừ tồn thực. Chuyển kho không lấy phần tồn
  đang giữ cho đơn. Nhập/xuất/nhận lại cùng yêu cầu không cộng/trừ hai lần.
- POS tính giá từ sản phẩm hoạt động và kiểm tra giá UI đang hiển thị. Không tin
  giá/tổng tiền tùy ý của trình duyệt. VAT được tính từ snapshot thuế suất dòng
  khi lập hóa đơn; chỉ một hóa đơn cho một đơn.
- Voucher cần khách hàng để kiểm tra giới hạn, chương trình còn hiệu lực, một
  voucher/đơn; phân bổ giảm giá bằng decimal. Đơn hủy vẫn tiêu thụ lượt đã dùng.
- Hoàn thành cần đã xuất, có hóa đơn và thu đủ. Thu không vượt số còn thiếu; hoàn
  không vượt số đã thu ròng; các yêu cầu cùng đơn được tuần tự hóa bằng khóa dòng.
- Thu/hoàn là **ghi nhận thủ công khoản đã xác nhận thực tế**. Chưa tích hợp cổng
  ngân hàng, webhook, hoàn tiền tự động hoặc hóa đơn điện tử pháp lý.
- Kiểm kê kiểm tra tồn lúc mở phiếu (`expected_quantity`), yêu cầu lý do và không
  cho hạ tồn dưới số đang giữ cho đơn.

## API đọc và UI

`GET /api/admin/operations/read/{kind}`:

- `summary?start=YYYY-MM-DD&end=YYYY-MM-DD`: tổng hợp server, tối đa 367 ngày;
  số lượng, đơn theo ngày/trạng thái/kênh, tồn theo kho, doanh thu hóa đơn, thu ròng,
  top 10 sản phẩm của đơn hoàn thành. Ngày theo Việt Nam; số tiền là chuỗi decimal.
- `search?q=...`: ít nhất hai ký tự, tối đa 5 kết quả mỗi nhóm đơn/sản phẩm/khách.
- `notifications`: tối đa 30 thông báo mỗi nhóm đơn mới/tồn thấp/ticket mới;
  trạng thái đã đọc riêng cho tài khoản, không phải dịch vụ push hay email.
- `settings`: cấu hình cửa hàng dùng chung, ngưỡng cảnh báo và thông tin bản in.
- `history?record_id=SKU&page=1`: sổ biến động, 20 bản ghi/trang; bỏ SKU để xem tất cả.
- `messages?record_id=UUID&page=1`: lịch sử trao đổi ticket, 20 tin/trang.

API bảng nhận `filters` là JSON các cột công khai và giá trị; không nhận biểu thức
SQL/PostgREST. Ví dụ `{"trang_thai":"MOI","ma_kho":-1}`. Cột ngày hỗ trợ hậu tố
`__from`, `__to` (bao gồm ngày cuối theo giờ Việt Nam). Bộ lọc không bỏ qua scope role.
Các liên kết phiếu → dòng hàng, chương trình → voucher, danh mục → sản phẩm có filter.

Admin có tìm kiếm Ctrl/Cmd+K, tìm kiếm mobile, bộ lọc, lựa chọn tham chiếu bằng tên,
ghi nhận tiền, in/lưu PDF qua trình duyệt, xuất báo cáo CSV, thông báo và cài đặt.
CSV escape nội dung có thể trở thành công thức bảng tính.

Ticket cập nhật qua wrapper `admin_update_feedback_thread_v1`, giữ lại từng phản hồi.
Khách có GET/POST `/api/customer/crm/feedback/{id}/messages`, chỉ ticket của mình;
POST cần Idempotency-Key. UI khách hiện vẫn có thể dùng trường phản hồi gần nhất;
màn hình hội thoại khách là phần tích hợp riêng, không thay đổi trong đợt admin này.

## Kiểm thử và review

- Pytest: HTTP/role/Origin, validation, lỗi database và ranh giới 3 lớp.
- `scripts/test_admin_operations.cjs`: tạo database test tạm ở **127.0.0.1**,
  chạy migration thật, thử toàn bộ luồng, rollback, tiền decimal, lượt voucher,
  RLS/quyền, idempotency và tranh chấp đồng thời. Tự xóa database test sau chạy.
  Cần PostgreSQL test trên port 55432 (hoặc PHUB_TEST_PG_PORT), Node và package `pg`.
  Chỉ dùng user postgres test; script không nhận URL production.
- `ui/adminUI/tests/admin-operations.e2e.cjs`: Next thật, API intercept để không ghi
  cloud; thao tác trạng thái, timeout/retry cùng key/body, tạo phiếu ID âm, lọc,
  tìm kiếm và kiểm tra tràn ngang mobile.
- Các test không chứng minh migration đã áp dụng hoặc Render đã được cập nhật.

Sau deploy, nghiệm thu bằng tài khoản test: tạo nhập 10 → đặt 4 → xác nhận/chuẩn bị
đơn → lập hóa đơn → ghi nhận thu; đối chiếu tồn kho, hóa đơn, giao dịch và sổ kho.
Xuất kho đơn hàng đang tạm ẩn; chuyển kho đã ngừng sử dụng. Không thử luồng ghi trên dữ liệu thật nếu chưa chủ động
chọn sản phẩm/kho test và xác nhận khoản tiền nào chỉ dùng cho kiểm thử.

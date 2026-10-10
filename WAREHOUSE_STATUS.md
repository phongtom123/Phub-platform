# PHUB Warehouse — báo cáo công việc ngày 2026-10-11

## Đã hoàn thành

- Nối giao diện kho với API Python qua Next.js gateway.
- Hoàn thiện workflow phiếu nhập: tạo nháp, sửa, hủy và xác nhận nhập kho.
- Hoàn thiện workflow chuyển kho: tạo nháp, sửa, hủy, giao và nhận chuyển kho.
- Thêm danh sách phiếu xuất theo đơn hàng và transaction xuất kho.
- Xuất kho có khóa đơn/tồn, kiểm tra tồn, chặn âm tồn, trừ `TON_KHO`, ghi audit và chuyển đơn sang `DA_XUAT_KHO`.
- Thêm `LICH_SU_TON_KHO` và trigger ghi lịch sử biến động tồn.
- Áp dụng kiểm tra quyền ADMIN/THU_KHO và giới hạn thủ kho theo kho được phân công.
- Dashboard/sidebar lấy số liệu live; lịch sử hiển thị giao dịch `XUAT_DON_HANG`.
- Thêm xuất CSV theo dữ liệu đã tìm kiếm/lọc.
- Frontend typecheck/build và backend compile đã pass; test draft workflow: 5 passed.

## Migration cần áp dụng trên database dùng bởi Render

Chạy theo thứ tự: `001` → `002` → `003` → `004` → `005` → `006` → `007` → `008`.
Nếu `002`/`003` đã chạy trước audit migration `005`, chạy lại `002` và `003` sau `005`.

Các migration kho là:

- `database/migrations/004_warehouse_draft_workflows.sql`
- `database/migrations/005_stock_movement_audit.sql`
- `database/migrations/006_warehouse_draft_cancellation.sql`
- `database/migrations/007_warehouse_draft_updates.sql`
- `database/migrations/008_order_dispatch_workflow.sql`

## Còn thiếu / cần kiểm thử

- Chưa xác nhận toàn bộ migration trên Supabase project thật mà Render đang dùng.
- Chưa chạy E2E thật: đăng nhập thủ kho → nhập kho → chuyển kho → xuất đơn → kiểm tra tồn/audit.
- Cần kiểm tra biến môi trường Render: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `FRONTEND_ORIGINS`, `COOKIE_SECURE=true`.
- Xuất đơn nhiều kho hiện chỉ hỗ trợ xuất trọn đơn bởi ADMIN; chưa hỗ trợ thủ kho xuất từng phần theo kho.
- Chưa có phiếu xuất độc lập ngoài đơn hàng.
- Hoàn tất đơn, hóa đơn, thanh toán, webhook và hoàn tiền thuộc các module khác, chưa nằm trong phần thủ kho.
- Full test suite chưa được chứng nhận trong môi trường này; mới xác nhận compile, typecheck, build và test workflow draft.

## Endpoint kho chính

```text
POST /api/warehouse/receipts/draft
POST /api/warehouse/receipts/{id}/confirm
POST /api/warehouse/transfers/draft
POST /api/warehouse/transfers/{id}/dispatch
POST /api/warehouse/transfers/{id}/receive
GET  /api/warehouse/dispatches
POST /api/warehouse/dispatches/{order_id}/dispatch
```


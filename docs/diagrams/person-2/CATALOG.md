# Danh mục nghiệm thu sơ đồ Người 2

Tác nhân chính của các workflow là nhân viên. Sequence dùng sáu tầng `Nhân viên → Giao diện → Controller → Service → Repository → Database`.

## Workflow

| Mã | Tiền điều kiện | Hậu điều kiện | Lỗi/nhánh chính | Nguồn đối chiếu |
| --- | --- | --- | --- | --- |
| N2-W01 | Nhân viên có phiên hợp lệ | Hồ sơ và tài khoản liên kết được hiển thị | Không có dữ liệu, lỗi đọc | `customers/`, `crm.py` |
| N2-W02 | Mở form khách hàng | Tạo hồ sơ, không tự tạo tài khoản admin | Dữ liệu không hợp lệ, lưu lỗi | bảng `customers` |
| N2-W03 | Hồ sơ tồn tại | Snapshot hồ sơ mới được hiển thị | Không tìm thấy, sai dữ liệu/quyền | `PATCH /crm/customers/{id}` |
| N2-W04 | Hồ sơ đang hoạt động | Hồ sơ được lưu trữ, chứng từ được giữ | Hủy xác nhận, sai quyền/trạng thái | `POST /crm/customers/{id}/archive` |
| N2-W05 | Hồ sơ đã lưu trữ | Hồ sơ được khôi phục, tài khoản không tự mở | Hủy xác nhận, lưu lỗi | RPC xóa mềm khách |
| N2-W06 | Chọn khách hợp lệ | Lịch sử đơn đúng khách được phân trang | Khách không tồn tại, lịch sử trống | `GET /crm/customers/{id}/orders` |
| N2-W07 | Có đơn được chọn | Hiển thị dòng hàng, giao nhận và tài chính | Đơn không tồn tại, dữ liệu con lỗi | `admin_order_detail.py` |
| N2-W08 | Nhân viên bán tại quầy | Chọn đúng khách active hoặc khách vãng lai | Email sai/trùng, thay email xóa lựa chọn | `/api/staff/counter/customers` |
| N2-W09 | Dòng hàng, kho và người mua hợp lệ | Tạo đơn tại quầy chưa mặc định đã thu | Giá/tồn/email đổi, rollback | `staff_counter_order_email_v1` |
| N2-W10 | Đơn và nhân viên hợp lệ | Người phụ trách được lưu | Nhân viên không hợp lệ, xung đột | `admin_operation_v1` action `assign` |
| N2-W11 | Đơn ở `MOI` | Đơn sang `XAC_NHAN` | Hủy xác nhận, trạng thái/phiên bản đổi | action `confirm` |
| N2-W12 | Đơn ở `XAC_NHAN` | Đơn sang `DANG_CHUAN_BI` | Trạng thái không hợp lệ | action `prepare` |
| N2-W13 | Đơn đủ điều kiện xuất | Tồn và lịch sử cập nhật đúng một lần | Thiếu hóa đơn, thiếu tồn, hết hạn | action `dispatch` |
| N2-W14 | Đơn đã xuất kho | Đơn chuyển `HOAN_THANH` | Chưa đủ tài chính/giao hàng | action `complete` |
| N2-W15 | Đơn ở trạng thái cho phép hủy | Đơn hủy, reservation được nhả, chứng từ giữ lại | Có khoản thu cần hoàn, xung đột | action `cancel` |
| N2-W16 | Có quyền tra cứu billing | Hiển thị hóa đơn và giao dịch liên quan | Không có dữ liệu, dữ liệu con lỗi | bảng `invoices`, `payments` |
| N2-W17 | Đơn có dòng hàng đã chốt | Hiển thị preview chỉ đọc | Đơn thiếu dữ liệu | `invoice-creator.tsx` |
| N2-W18 | Đơn chưa có hóa đơn | Hóa đơn duy nhất được ghi trong transaction | Hóa đơn đã có, tổng đổi, rollback | action `invoice` |
| N2-W19 | Hóa đơn và dòng hàng tải đủ | Mở hộp thoại in/lưu PDF trình duyệt | Dữ liệu in thiếu, đơn đổi trạng thái | `invoice-print.tsx` |
| N2-W20 | Hóa đơn còn phải thu và đã nhận tiền thực tế | Bút toán thu được ghi | Quá hạn, vượt số phải thu, trùng đối soát | action `payment` |
| N2-W21 | Có khoản thu được phép hoàn và đã hoàn thực tế | Bút toán hoàn được ghi | Vượt giới hạn, trùng yêu cầu | action `refund` |
| N2-W22 | Có ticket liên kết | Dữ liệu khách, hóa đơn và phiên bản được đối chiếu | Ticket/hóa đơn thiếu, đơn đã có chủ | claim read RPC |
| N2-W23 | Ticket đã xác minh, đơn tại quầy chưa có chủ | Gắn đúng khách, giữ tiền/tồn/chứng từ | Xung đột phiên bản hoặc ownership | `staff_invoice_claim_decide_v1` approve |
| N2-W24 | Ticket đã đối chiếu | Lưu từ chối và lý do, không cấp quyền đơn | Thiếu lý do, xung đột phiên bản | claim decision reject |
| N2-W25 | Có quyền đọc chương trình | Hiển thị chương trình và voucher liên quan | Danh sách trống, lỗi dữ liệu con | bảng promotions/vouchers |
| N2-W26 | Form chương trình hợp lệ | Tạo chương trình mới | Thời gian/trạng thái sai | bảng promotions |
| N2-W27 | Chương trình còn được sửa | Lưu snapshot mới | Trạng thái chặn sửa, dữ liệu sai | inline table update |
| N2-W28 | Chương trình tồn tại | Trạng thái được bật hoặc tạm ngừng | Chuyển trạng thái không hợp lệ | trường `trang_thai` |
| N2-W29 | Chọn chương trình và media hợp lệ | Banner được thay/gỡ và kiểm tra preview | Tệp sai, upload/lưu lỗi | `promotion-banner.tsx` |
| N2-W30 | Có quyền đọc voucher | Hiển thị điều kiện, quota và lượt dùng | Danh sách trống, dữ liệu con lỗi | vouchers/voucher-uses |
| N2-W31 | Chương trình và điều kiện hợp lệ | Tạo voucher mới | Mã/giảm/quota/tham chiếu sai | bảng `VOUCHER` |
| N2-W32 | Voucher tồn tại | Lưu điều kiện/trạng thái, giữ lượt dùng | Điều kiện sai, lưu xung đột | checkout voucher contract |

## Sequence

| Mã | Phạm vi | Hậu điều kiện | Lỗi/nhánh chính | Endpoint/RPC |
| --- | --- | --- | --- | --- |
| N2-S01 | Tạo hoặc sửa hồ sơ | Hồ sơ mới hoặc snapshot đã commit | Validate, quyền, không tìm thấy | tables API / CRM update |
| N2-S02 | Xóa mềm hoặc khôi phục | Trạng thái lưu trữ đổi, lịch sử giữ | Sai quyền, hồ sơ thiếu | CRM archive RPC |
| N2-S03 | Tra email và tạo đơn quầy | Đơn/dòng hàng ghi một lần, chưa tự thu | Email, giá, tồn, idempotency | `staff_counter_order_email_v1` |
| N2-S04 | Assign/confirm/prepare | Người phụ trách hoặc trạng thái mới | Phiên bản và trạng thái xung đột | `admin_operation_v1` |
| N2-S05 | Dispatch đơn | Trừ tồn và ghi lịch sử đúng một lần | Hóa đơn/tồn/trạng thái không đủ | `admin_operation_v1` dispatch |
| N2-S06 | Hoàn thành đơn | Trạng thái `HOAN_THANH` | Thiếu thanh toán hoặc sai trạng thái | `admin_operation_v1` complete |
| N2-S07 | Nhân viên hủy đơn | Hủy và nhả reservation, giữ chứng từ | Khoản thu cần hoàn, trạng thái chặn | `admin_operation_v1` cancel |
| N2-S08 | Preview và phát hành hóa đơn | Preview không ghi; phát hành ghi duy nhất | Hóa đơn đã có, dữ liệu đổi | `admin_operation_v1` invoice |
| N2-S09 | Ghi nhận thu | Bút toán thu và tổng mới | Quá hạn, vượt số phải thu, trùng khóa | `admin_operation_v1` payment |
| N2-S10 | Ghi nhận hoàn | Bút toán hoàn và tổng mới | Vượt giới hạn, trùng đối soát | `admin_operation_v1` refund |
| N2-S11 | Approve/reject claim | Ticket quyết định; approve mới gắn khách | Ownership, phiên bản, đơn có chủ | `staff_invoice_claim_decide_v1` |
| N2-S12 | Lưu chương trình/voucher | Bản ghi tiếp thị đã lưu | Thời gian, mức giảm, quota, tham chiếu | tables service/repository |

## Điểm lệch không vẽ thành công

`N2-G01`: thao tác khóa/mở/ẩn/hiện tài khoản khách từ hồ sơ nhân viên không nằm trong bộ sơ đồ. UI có điểm gọi API quản lý tài khoản nhưng dependency backend yêu cầu vai trò `ADMIN`; nhân viên chỉ được quản lý hồ sơ CRM theo phạm vi trên.

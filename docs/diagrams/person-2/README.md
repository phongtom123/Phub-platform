# Sơ đồ Người 2 — Nhân viên: khách hàng, bán hàng và khuyến mãi

Thư mục này chứa 32 workflow (`N2-W01`–`N2-W32`) và 12 sequence (`N2-S01`–`N2-S12`) theo phân công tại
[`PHAN-CONG-VE-SO-DO-NHAN-VIEN-USER.md`](../../PHAN-CONG-VE-SO-DO-NHAN-VIEN-USER.md).

Quy ước trình bày:

- Mỗi sơ đồ là một file Mermaid độc lập; không ghép `flowchart` và `sequenceDiagram` trong cùng file.
- Nền trắng, chữ đen, viền và đường nối đen để in trắng đen rõ ràng.
- Workflow có bắt đầu/kết thúc, dữ liệu vào, điều kiện, xử lý và nhánh lỗi hoặc hủy cần thiết.
- Sequence đi theo `Người dùng → Giao diện → Controller → Service → Repository → Database`; thông điệp đánh số trong nội dung.
- Preview chỉ đọc; hóa đơn không đồng nghĩa đã thanh toán; ghi sổ thu/hoàn không đại diện chuyển tiền ngân hàng thật.
- Không có workflow khóa/mở tài khoản khách cho nhân viên. UI hiện có gọi API chỉ dành cho Admin nên đây là điểm lệch `N2-G01`, không phải luồng thành công.

Nguồn đối chiếu chính:

- `Backend/phub_api/controllers/crm.py`, `services/crm.py`, `repositories/crm.py`
- `Backend/phub_api/controllers/admin_operations.py`, `services/admin_operations.py`, `repositories/admin_operations.py`
- `Backend/phub_api/controllers/invoice_claims.py`, `services/invoice_claims.py`, `repositories/invoice_claims.py`
- `ui/adminUI/src/features/customers/`, `operations/`, `forms/promotion-banner.tsx`
- `ui/warehouseUI/src/features/invoice-claims/` và `internal/dispatch-orders.tsx`

Các file nguồn `.mmd` là bản chỉnh sửa được. Bản xuất đã kiểm tra nằm trong thư mục [`rendered/`](rendered/), gồm 44 file SVG nền trắng. Mô tả nghiệm thu từng mã nằm tại [`CATALOG.md`](CATALOG.md).

Toàn bộ 44 sơ đồ cũng đã được đóng gói trong một file Draw.io nhiều trang: [`PHUB-NGUOI-2.drawio`](PHUB-NGUOI-2.drawio). Mỗi page dùng shape, text và connector native của Draw.io nên có thể chọn, di chuyển và sửa từng thành phần; không nhúng SVG dưới dạng ảnh. Nguồn Mermaid vẫn được giữ trong thuộc tính `mermaidSource` của page để đối chiếu.

Khi nguồn `.mmd` thay đổi, chạy [`build-editable-drawio.ps1`](build-editable-drawio.ps1) để tạo lại file Draw.io editable.

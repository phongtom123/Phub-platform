# Chỉnh sửa thông tin phiếu nháp

Hai API chỉ dành cho ADMIN có hồ sơ nhân viên:

- `PATCH /api/admin/warehouse-drafts/receipts?key=[ma_phieu_nhap]`
- `PATCH /api/admin/warehouse-drafts/transfers?key=[ma_phieu_chuyen]`

Query `key` là mảng JSON gồm một số nguyên, phải URL-encode khi gửi. API dùng cùng cookie/Bearer và kiểm tra Origin như các API quản trị khác.

Phiếu nhập cho sửa `ma_phieu_code`, `ma_ncc`, `ma_kho`, `ghi_chu`. Server tự ghi `nguoi_cap_nhat` từ phiên đăng nhập. Phiếu chuyển kho cho sửa `ma_kho_xuat`, `ma_kho_nhan`, `ghi_chu`; hai kho phải khác nhau. Khóa ngoại được database kiểm tra.

Chỉ chấp nhận phiếu có trạng thái `NHAP`. Điều kiện này nằm trong câu UPDATE cùng khóa chính, vì vậy phiếu vừa được xác nhận trong lúc người dùng sửa sẽ trả `409`. Không cập nhật trạng thái, dòng hàng hoặc tồn kho bằng hai API này. Không mở quyền POST/PATCH chung cho chứng từ.

Metadata `/api/data/resources` trả `draft_update_path` và `draft_update_fields` cho ADMIN. `writable` của hai bảng vẫn là `false`, vì không cho tạo chứng từ qua API bảng chung. UI dùng đường dẫn riêng, chỉ mở sửa hàng nháp và giữ ghi chú trong trang chi tiết.

Không cần đổi schema hay chạy migration. Khi triển khai cloud, cập nhật backend và UI cùng phiên bản; backend cũ không trả metadata sửa phiếu nên UI giữ hai bảng ở chế độ chỉ đọc.

Kiểm thử: `Backend/tests/test_platform_api.py` kiểm tra quyền, Origin, trường được sửa, phiếu đã xử lý và xung đột đồng thời. `ui/adminUI/tests/additional-inline-tables.e2e.cjs` kiểm tra sáu bảng bằng API giả lập, không sửa dữ liệu thật.

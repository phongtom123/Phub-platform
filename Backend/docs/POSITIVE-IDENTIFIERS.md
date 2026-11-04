# Chuẩn hóa mã số dương

Migration: `20261101083932_normalize_positive_identifiers.sql`.

Các khóa số của chương trình khuyến mãi, chi tiết đơn hàng, kho, nhà cung cấp,
phiếu chuyển, phiếu nhập, lượt dùng voucher, thanh toán và voucher phải lớn hơn 0.
Mã chuỗi và UUID giữ nguyên.

Migration đổi mã trực tiếp trên bản ghi, cập nhật các khóa ngoại cùng giao dịch,
đồng bộ bộ đếm identity và bổ sung ràng buộc chống chèn mã âm/0. Mã âm được đổi
thành trị tuyệt đối khi chưa có mã dương tương ứng; nếu trùng, cấp mã mới trên
dải hiện có. Không dùng `abs()` trực tiếp cho toàn bộ khóa mà bỏ qua khóa ngoại.

Lịch sử tồn kho còn dùng mã seed cũ được đối chiếu theo tên kho hiện có:

- `-900001`: `[SEED] Kho trung tâm`.
- `-900002`: `[SEED] Kho chi nhánh A`.
- `-900003`: `[SEED] Kho chi nhánh B`.

Mã kho trong `customer_order_private.idempotency.receipt.items` cũng được cập nhật,
có kiểm tra đối chiếu với kho trên dòng đơn hàng thực tế. Các giá trị khác trong
kết quả đơn hàng được giữ nguyên.

Trước khi áp dụng lên dữ liệu hiện có, đã chạy toàn bộ migration rồi rollback.
Migration tự so sánh toàn bộ bản ghi với kết quả dự kiến để phát hiện thay đổi
ngoài các trường mã; giá, số lượng, trạng thái, thời gian và thông tin khách hàng
phải không đổi. Trigger nghiệp vụ được khôi phục trạng thái cũ; khóa ngoại vẫn
được kiểm tra. Việc đặt lại sequence dùng `ALTER SEQUENCE ... RESTART` để có thể
rollback cùng giao dịch.

Bản sao trước thay đổi và bảng đối chiếu mã được giữ tại
`.id-normalization-local/before-20261101.json` và
`.id-normalization-local/id-mapping-20261101.json` ở gốc repo, được gitignore.

Script `scripts/seed_sample_products.py` sử dụng `OPERATING_WAREHOUSE_ID` thay vì
mã kho seed âm. Các mã âm trong fixture kiểm thử cũ không phải dữ liệu đang chạy.

Kết quả đối chiếu ngày 2026-11-01: 45 mã chính được đổi, 162 dòng lịch sử kho và
8 kết quả đơn hàng lưu sẵn được đồng bộ. Quét 53 cột mã không còn giá trị âm;
1.009 bản ghi khớp kết quả dự kiến, không đổi giá, số lượng hay trạng thái.

Kiểm tra: 25 test kho đạt và OpenAPI snapshot khớp ứng dụng. Hai bộ test cũ
`test_orders.py`/`test_platform_api.py` có 49 lỗi, 232 test đạt; chạy đối chiếu
với schema gốc trên HEAD cũng cho đúng các lỗi này, không phát sinh từ lần đổi mã.

# Báo cáo kinh doanh trong admin

**Cập nhật 01/11/2026:** mặc định báo cáo **tất cả kho**, có bộ lọc từng kho.
Migration `20261101164437_business_report_warehouse_scope.sql` thêm RPC v2 chỉ đọc,
giữ RPC v1 cho backend cũ. Đã áp dụng trên Supabase Phub. Khoản thu 5.500.000đ của
đơn đang chuẩn bị ở kho 4 đã được xác minh trong dòng tiền ngày 01/11/2026 của cả
báo cáo tất cả kho và riêng kho 4; doanh thu vẫn bằng 0 do đơn chưa hoàn thành.

## Đã triển khai

- Trang `/reports`, menu **Tổng quan → Báo cáo kinh doanh**.
- Link từ khối **Doanh thu và thu tiền** trên dashboard, giữ kỳ đang xem.
- Chọn kho, ngày bắt đầu/kết thúc, chọn nhanh 7/30/90 ngày, làm mới và xuất CSV.
- Tối đa 366 ngày/kỳ; thời gian theo Việt Nam. URL lưu `start`, `end`, `warehouse_id` tùy chọn để chia sẻ hoặc mở lại.
- API `GET /api/admin/operations/business-report?start=...&end=...` gọi RPC `admin_business_report_v2`. Bỏ `warehouse_id` để lấy tất cả kho; thêm `warehouse_id=4` để lấy riêng kho 4. Response xác nhận `scope=ALL_WAREHOUSES, warehouse_id=null` hoặc `scope=WAREHOUSE, warehouse_id=<mã kho>`. Chỉ ADMIN đang hoạt động; hàm STABLE/SECURITY INVOKER và chỉ service_role được EXECUTE. Không thêm/sửa/xóa bảng, cột hay dữ liệu nghiệp vụ.
- Đối chiếu cả kỳ, phạm vi kho và định dạng số tiền trước khi hiển thị. Khi đổi kỳ/kho hoặc lỗi tải, không xuất số liệu cũ dưới bộ lọc mới.
- Giữ cơ chế đọc lại 10 giây hiện có; lỗi cập nhật nền giữ bản lần trước và khóa xuất CSV đến khi đọc lại thành công.

## Ý nghĩa số liệu hiện tại

- **Doanh thu sau giảm giá, chưa thuế**: tổng `so_luong * don_gia - giam_gia - giam_gia_voucher` của chi tiết đơn HOAN_THANH, theo ngày hoàn thành trong kỳ. Thuế tách riêng. Không trừ giảm giá lần hai.
- **Thu tiền thực nhận**: giao dịch thu thành công trừ giao dịch hoàn thành công trong kỳ theo ngày giao dịch. Không phải lợi nhuận.
- Báo cáo tất cả kho cộng mỗi giao dịch đúng một lần, kể cả đơn chưa hoàn thành hoặc có hàng ở nhiều kho. Báo cáo riêng kho chỉ tính tiền của đơn hoàn toàn thuộc kho đó; không tự phân bổ giao dịch của đơn nhiều kho. Không tính khoản chờ xử lý/thất bại thành tiền đã thu.
- **Theo sản phẩm/ngày**: toàn bộ SKU của đơn hoàn thành, số lượng/doanh thu/giá vốn/lợi nhuận/biên; tìm kiếm SKU/tên và phân trang. CSV xuất toàn bộ, không chỉ trang hiện tại.
- Bộ lọc ngày trên trang không thay đổi định nghĩa hoặc tự xử lý lại số liệu của API.

## Phương pháp hiện tại: bình quân gia quyền liên hoàn

Tính riêng từng SKU/kho từ lịch sử chứng từ, không nối trực tiếp hai bảng chi tiết gây nhân bản dữ liệu:

- Sau mỗi lần nhập: đơn giá bình quân = (giá trị tồn + số lượng nhập × giá nhập) / (số lượng tồn + số lượng nhập).
- Chỉ phiếu DA_NHAP mới tăng tồn. Mọi đơn DA_XUAT_KHO/HOAN_THANH tiêu thụ số lượng/giá vốn tại lúc xuất, kể cả đơn chưa hoàn thành trong kỳ.
- Đọc cả lịch sử trước kỳ, đến ngày cuối kỳ; không dùng phiếu nhập sau ngày xuất để tính lại giá vốn bán trước.
- Sắp thời gian, nhập trước xuất nếu cùng timestamp, sau đó mã chứng từ/SKU/dòng. Giá vốn dòng làm tròn 2 chữ số và trừ khỏi giá trị tồn.
- Đơn xuất kỳ trước, hoàn thành kỳ này: ghi nhận doanh thu và giá vốn cùng kỳ hoàn thành, giữ giá vốn tính lúc xuất.

## Công thức

1. Doanh thu thuần chưa thuế = doanh thu bán hàng chưa thuế − các khoản giảm trừ doanh thu. Không trừ lại phần giảm giá đã nằm trong giá trị hóa đơn.
2. Giá vốn hàng đã bán = tổng (số lượng hàng đã bán × đơn giá bình quân tại thời điểm xuất).
3. Lợi nhuận gộp = doanh thu thuần chưa thuế − giá vốn hàng đã bán.
4. Biên lợi nhuận gộp (%) = lợi nhuận gộp / doanh thu thuần chưa thuế × 100. Doanh thu thuần bằng 0 thì không xác định.

**Không** lấy tổng tiền nhập kho trong kỳ hoặc giá nhập mới nhất để suy ra giá vốn hàng đã bán. Hàng nhập có thể chưa bán và đơn cũ không được đổi giá vốn theo lần nhập mới.
Không gọi lợi nhuận gộp là lợi nhuận ròng: hệ thống chưa ghi đủ lương, thuê mặt bằng, quảng cáo và các chi phí vận hành khác.

## Dữ liệu chưa đủ và giới hạn

- Đối chiếu nhập/xuất trong chứng từ với TON_KHO hiện tại. Lệch tồn, điều chỉnh/chuyển kho chưa định giá, thiếu ngày nhập/xuất hoặc xuất quá lượng nhập: cảnh báo INCOMPLETE_COST_HISTORY. Không tự dựng giá vốn đầu kỳ hoặc dùng lần nhập sau để bù lần xuất trước.
- Có `costed_lines`, `total_lines`, `known_cost` để đối soát. Dòng thiếu giá vốn trả null, không phải 0; tổng giá vốn chỉ xác định khi đủ mọi dòng trong kỳ.
- Hoàn tiền không xác định SKU/hàng trả/thuế. Có hoàn trong kỳ hoặc hoàn liên quan đến đơn trong kỳ trước ngày kết thúc: cảnh báo UNALLOCATED_REFUNDS; chưa xác định lợi nhuận/biên. Doanh thu lúc này là trước phân bổ hoàn tiền. Không tự giả định hàng đã nhập lại hoặc phân bổ hoàn theo tỷ lệ.
- Không có đơn và không có vấn đề hoàn tiền: doanh thu/giá vốn/lợi nhuận bằng 0, biên null.
- Hạn chế 20.000 dòng nhập/xuất lịch sử, vượt thì báo lỗi rõ ràng, không trả báo cáo bị cắt thiếu.
- Đây là tái dựng từ chứng từ, chưa phải sổ giá vốn khóa kỳ. Sửa chứng từ có thể đổi kết quả; đối chiếu tồn hiện tại là kiểm tra bảo thủ nên điều chỉnh hiện tại có thể khiến kỳ cũ chưa đủ dữ liệu.
- Dashboard cũ vẫn là doanh thu hóa đơn gồm thuế theo ngày lập hóa đơn; không so trực tiếp với báo cáo đơn hoàn thành/chưa thuế như cùng một chỉ tiêu.

## Triển khai và kiểm tra tập trung

Sau các migration báo cáo trước đó, áp dụng `Backend/migrations/20261101164437_business_report_warehouse_scope.sql`, deploy backend mới rồi admin. Khi thiếu API/hàm hoặc sai phạm vi, UI báo rõ, không tự thay bằng báo cáo cũ. Migration chỉ tạo hàm đọc, không ghi chứng từ/tồn kho.

- `Backend/scripts/test_business_report.cjs`: PGlite cô lập (đặt PHUB_PGLITE_MODULE nếu cần), không kết nối cloud.
- `Backend/scripts/test_report_warehouse_scope.cjs`: tiền thu đơn chưa hoàn thành, phạm vi toàn bộ/từng kho, giá vốn riêng theo kho, đơn nhiều kho không nhân đôi dòng tiền, tương thích v1 và quyền truy cập.
- `Backend/tests/test_business_report.py`: quyền, ngày, RPC và thiếu migration.
- `ui/adminUI/tests/reports.e2e.cjs`: API giả lập, KPI/CSV, bảng SKU/ngày, chọn kỳ, sai kỳ, mobile.

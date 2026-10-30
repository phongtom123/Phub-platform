# Báo cáo kinh doanh trong admin

**Cập nhật 30/10/2026:** phạm vi mới chỉ **kho 2 — Kho trung tâm**. Xem [quy tắc một kho cố định](SINGLE-WAREHOUSE.md); migration `20261030034222_fixed_operating_warehouse.sql` thay thế hàm báo cáo cũ mà không sửa số liệu nghiệp vụ. Các giới hạn chuyển kho/hoàn tiền bên dưới mô tả phiên bản đầu; phiên bản mới đọc xuất chuyển kho cũ để tái dựng tồn và tách hoàn tiền đơn hủy trước xuất khỏi hoàn tiền hàng bán.

## Đã triển khai

- Trang `/reports`, menu **Tổng quan → Báo cáo kinh doanh**.
- Link từ khối **Doanh thu và thu tiền** trên dashboard, giữ kỳ đang xem.
- Chọn ngày bắt đầu/kết thúc, chọn nhanh 7/30/90 ngày, làm mới và xuất CSV.
- Tối đa 366 ngày/kỳ; thời gian theo Việt Nam. URL lưu `start`, `end` để chia sẻ hoặc mở lại.
- API `GET /api/admin/operations/business-report?start=...&end=...` gọi RPC `admin_business_report_v1`. Chỉ ADMIN đang hoạt động; hàm STABLE/SECURITY INVOKER và chỉ service_role được EXECUTE. Không thêm/sửa/xóa bảng, cột hay dữ liệu.
- Đối chiếu kỳ được API trả về và định dạng số tiền trước khi hiển thị. Khi đổi kỳ hoặc lỗi tải, không xuất số liệu cũ dưới kỳ mới.
- Giữ cơ chế đọc lại 10 giây hiện có; lỗi cập nhật nền giữ bản lần trước và khóa xuất CSV đến khi đọc lại thành công.

## Ý nghĩa số liệu hiện tại

- **Doanh thu sau giảm giá, chưa thuế**: tổng `so_luong * don_gia - giam_gia - giam_gia_voucher` của chi tiết đơn HOAN_THANH, theo ngày hoàn thành trong kỳ. Thuế tách riêng. Không trừ giảm giá lần hai.
- **Thu tiền thực nhận**: giao dịch thu thành công trừ giao dịch hoàn thành công trong kỳ theo ngày giao dịch. Không phải lợi nhuận.
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

Áp dụng `Backend/migrations/20261030020310_business_report.sql`, deploy backend mới rồi admin. Khi thiếu API/hàm, UI báo rõ, không tự thay bằng báo cáo cũ. Migration chỉ tạo hàm đọc, không ghi chứng từ/tồn kho.

- `Backend/scripts/test_business_report.cjs`: PGlite cô lập (đặt PHUB_PGLITE_MODULE nếu cần), không kết nối cloud.
- `Backend/tests/test_business_report.py`: quyền, ngày, RPC và thiếu migration.
- `ui/adminUI/tests/reports.e2e.cjs`: API giả lập, KPI/CSV, bảng SKU/ngày, chọn kỳ, sai kỳ, mobile.

# Phạm vi kho

## Cập nhật 01/11/2026: mở lại các kho

Migration `Backend/migrations/20261101162759_unlock_warehouses.sql` gỡ giới hạn chỉ
vận hành kho 2. API kho/tồn kho của ADMIN trả tất cả kho; có thể sửa thông tin kho,
chọn kho hoạt động khi lập phiếu nhập, tạo đơn và phân công nhân viên. Nhân viên
vẫn chỉ truy cập chứng từ/tồn kho của kho được phân công; kiểm tra trạng thái kho,
tồn khả dụng, giá, khóa giao dịch và idempotency vẫn giữ nguyên.

Catalog và checkout xét các kho hoạt động. Migration không đổi trạng thái kho,
tồn kho, giá, đơn hàng, phiếu nhập hoặc phân công nhân viên. Supabase hiện có
4 kho (1, 2, 3, 4) đều hoạt động nên không cần cập nhật trạng thái hàng loạt.
Đã áp dụng migration trên Supabase Phub ngày 01/11/2026; checksum của kho, tồn,
nhân viên, phiếu nhập và đơn hàng trước/sau giữ nguyên. API local đã đọc được
đủ các mã kho 1, 2, 3, 4 từ Supabase thật.
Chức năng chuyển kho vẫn ngừng sử dụng theo quyết định trước đó.

Báo cáo kinh doanh sau migration `20261101164437_business_report_warehouse_scope.sql`
mặc định toàn bộ kho, cho phép chọn riêng kho và xác nhận phạm vi qua API.
Tiền thu của đơn chưa hoàn thành vẫn tính theo ngày thanh toán. Doanh thu và
giá vốn chỉ ghi nhận khi đơn hoàn thành; xem [báo cáo kinh doanh](BUSINESS-REPORTS.md).
Cần triển khai backend và UI mới để bỏ các chặn ở lớp ứng dụng.
Kiểm chứng migration bằng `Backend/scripts/test_unlocked_warehouses.cjs` và
`Backend/tests/test_fixed_warehouse.py`; các bài kiểm tra không ghi dữ liệu thật.

## Lịch sử quyết định ngày 30/10/2026 (đã được thay thế)

Quyết định ngày 30/10/2026: vận hành duy nhất **kho 2 — [SEED] Kho trung tâm**. Chức năng chuyển kho tạm dừng; các kho và chứng từ cũ không bị xóa, gộp hay tự đổi mã.

## Mã và cấu hình

- Backend dùng `phub_api/config/warehouse.py`; database dùng `admin_ops.operating_warehouse_id()`. Cả hai cùng là `2`, theo lựa chọn cụ thể của chủ hệ thống. Không lấy kho đầu tiên trong danh sách và không tự chọn theo thứ tự trả về.
- API danh sách kho/chọn kho và tồn kho chỉ trả kho 2. Metadata kho chỉ đọc. Dữ liệu chứng từ cũ ở các kho khác vẫn lưu nguyên trong DB và có thể tra cứu; nghiệp vụ mới không ghi vào những kho đó.
- Backend kiểm tra kho khi tạo phiếu nhập, đơn, điều chỉnh tồn và phân công nhân viên. Nhân viên chưa phụ trách kho 2 bị từ chối chức năng kho; ADMIN phải đổi phân công một cách chủ động.
- Database có trigger chặn ghi ngoài kho 2 trên phiếu nhập/chi tiết, tồn, dòng đơn, cập nhật đơn, hóa đơn/thanh toán và phân công nhân viên. Chặn tạo hoặc sửa/xóa chứng từ chuyển kho; không sửa các hàng cũ khi cài migration.
- Catalog kiểm tra tồn ở kho 2. Checkout chỉ chọn kho 2, thiếu hàng không chuyển sang kho khác. Cấu hình giá bán vẫn dùng Decimal và snapshot phiếu nhập như [định giá phiếu nhập](../Backend/docs/RECEIPT_PRICING.md).

## Báo cáo và dữ liệu lịch sử

- `/reports` và CSV ghi rõ kho 2. API trả `warehouse_id=2`; UI từ chối bản API cũ còn trả số liệu gộp các kho.
- Doanh thu, thuế, giá vốn theo dòng hàng xuất ở kho 2. Giá vốn bình quân liên hoàn chỉ dùng phiếu nhập của kho 2; không lấy giá nhập kho khác thay thế.
- Phiếu chuyển kho cũ đi ra từ kho 2 được đọc như xuất tồn theo giá bình quân tại thời điểm xuất. Mục đích là đối chiếu lịch sử; không có thao tác chuyển kho mới.
- Chuyển kho cũ đi vào kho 2 chưa có snapshot giá vốn, thiếu ngày hoặc tồn lệch vẫn báo chưa đủ dữ liệu. Không dựng giá vốn bằng 0 hoặc xóa cảnh báo để che dữ liệu thiếu.
- Sau migration `20261030154352_report_stock_adjustment_timeline.sql`, điều chỉnh tồn được xử lý theo thời điểm ghi nhận. Log điều chỉnh sau ngày xuất không xóa giá vốn đã tính cho lần xuất trước đó, kể cả đơn hoàn thành sau điều chỉnh. Đối chiếu tồn hiện tại dùng số lượng ở lần điều chỉnh cuối và chứng từ phát sinh sau đó, không cộng điều chỉnh như một phiếu nhập. Hàng tồn sau điều chỉnh chỉ có số lượng mà chưa có giá trị vẫn không được tự đoán giá vốn; khi đã xác nhận tồn bằng 0, phiếu nhập đủ giá sau đó có thể xác lập lại giá vốn. Sai lệch tồn không có lịch sử giải thích vẫn được cảnh báo.
- Dòng tiền thu/hoàn chỉ cộng giao dịch của đơn hoàn toàn thuộc kho 2. Đơn lịch sử có nhiều kho không được tự phân bổ toàn bộ tiền thu vào kho 2; UI/CSV ghi rõ phạm vi chỉ tiêu dòng tiền.
- Hoàn tiền của đơn `HUY` chưa xuất và chưa hoàn thành vẫn trừ dòng tiền thực nhận, nhưng không chặn lợi nhuận bán hàng của kỳ. Hoàn tiền hàng đã bán hoặc trạng thái chưa rõ vẫn giữ cảnh báo phân bổ; không tự nhập hàng trả lại.
- Dashboard/số đếm và danh sách chứng từ cũ có thể vẫn chứa hồ sơ lịch sử toàn hệ thống; không so chúng với báo cáo riêng kho 2 như cùng phạm vi.

## Triển khai

Áp dụng `Backend/migrations/20261030034222_fixed_operating_warehouse.sql` sau các migration customer orders/checkout, admin operations, warehouse receipts và receipt sale pricing. Không chạy lại initial schema hoặc seed trên database thật.

Migration không đổi tồn kho, giá, đơn, giao dịch tiền, trạng thái kho hay phân công nhân viên hiện có. Backend/SQL và Admin UI phải triển khai cùng phiên bản; client cũ gửi kho khác sẽ bị từ chối. Nếu cần đổi kho cố định sau này, phải có kế hoạch dữ liệu và migration riêng, không chỉ đổi hằng số frontend.

Đã áp dụng migration trên Supabase Phub ngày 30/10/2026. Báo cáo 01–30/09/2026 của kho 2 trả doanh thu chưa thuế 44.500.000đ, giá vốn 31.500.000đ, lợi nhuận gộp 13.000.000đ, biên 29,21%, `warnings=[]`. Checksum tồn, giá và phân công nhân viên trước/sau giữ nguyên; vẫn giữ 5 phiếu nhập và 4 phiếu chuyển cũ. Chỉ truy vấn đọc để xác minh trên database thật.

Kiểm tra giới hạn tài nguyên: `Backend/scripts/test_fixed_warehouse.cjs` chạy PostgreSQL cục bộ bằng PGlite, bao gồm giá vốn chuyển kho cũ, hoàn tiền đơn hủy, cảnh báo thật, chặn ghi ngoài kho và checkout không chọn kho khác; `tests/test_fixed_warehouse.py` kiểm tra ranh giới API. Không dùng dữ liệu thật để thử ghi.

`Backend/scripts/test_report_stock_timeline.cjs` tái hiện lỗi mở rộng kỳ báo cáo làm mất giá vốn, sau đó kiểm tra bản sửa với điều chỉnh muộn, điều chỉnh tương lai, đơn hoàn thành sau ngày điều chỉnh, tồn chưa đủ định giá và thứ tự log cùng thời điểm. Migration này chỉ thay hàm báo cáo, không ghi lại tồn, đơn hàng, giá nhập hoặc nhật ký.

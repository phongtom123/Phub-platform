# Kiểm tra lại CRM sau PR #125 — 08/11/2026

> Cập nhật sau lượt sửa local: bốn vấn đề bên dưới đã được sửa trong worktree,
> chưa commit/push. Phần đánh giá sau PR #125 được giữ làm lịch sử.
> Scoring chuyển vào service `crm_survey_metrics.py`: chỉ tính câu DIEM_1_5
> thuộc HAI_LONG, giữ số lẻ; không suy diễn điểm sản phẩm/dịch vụ.
> Chia kỳ theo giờ Việt Nam; các truy vấn CRM phân trang đều có order bằng khóa duy nhất.
> Kiểm tra: 1.407 backend tests, 4 frontend tests, TypeScript admin/staff và OpenAPI đạt.
> Truy vấn đọc trên Supabase thật xác nhận 9 khóa sắp xếp và tổng hợp khảo sát;
> không có thao tác ghi/migration. Schema giới tính và thông báo CRM vẫn ngoài lượt sửa này.

## Rà bổ sung sau lượt sửa local: còn 3 vấn đề giao diện/báo cáo

> Cập nhật sau khi sửa tiếp: cả A–C đã sửa local, chưa push.
> Nút Làm mới và đổi bộ lọc cùng dùng hook `use-customer-insights.ts`;
> request cũ bị hủy/bỏ kết quả, snapshot gắn với scope, kỳ và lần tải hiện tại.
> API trả sai scope/kỳ hoặc lỗi sẽ không có snapshot để xuất CSV.
> CSV lấy nhãn từ phạm vi của chính báo cáo; biểu đồ tính tỷ lệ từ tổng số lượng
> của các ngành hàng đang hiển thị. Bảng doanh thu giữ tỷ trọng doanh thu và ghi rõ nhãn.
> Kiểm tra: 8 unit tests frontend, TypeScript admin/staff và browser fixtures đều đạt.
> Script hồi quy: `ui/adminUI/tests/customer-insights.e2e.cjs`.
> Các mô tả tái hiện bên dưới được giữ làm lịch sử trước sửa.

Đã kiểm tra lại 36 ca CRM có mục tiêu: đều đạt. Các ca browser dưới đây giả lập
mọi API và chặn thao tác ghi, không sửa dữ liệu thật.

### A. [P1] Kết quả Làm mới cũ có thể ghi đè bộ lọc mới

- Vị trí: `ui/adminUI/src/features/customer-insights/customer-insights-view.tsx:88`.
- Tái hiện: tải ACTIVE → bấm Làm mới và giữ phản hồi chậm → chuyển COMPLETED
  → COMPLETED trả 0 → phản hồi ACTIVE cũ đến sau và ghi đè thành 9.900.000đ.
  Nhãn trên màn hình vẫn là doanh thu đơn hoàn thành.
- Nguyên nhân: request tạo từ onClick không được giữ trong controller của effect;
  không kiểm tra số thứ tự request/scope trước khi setReport/setLoading.
- Cần quản lý chung request từ effect và nút Làm mới, hủy hoặc bỏ kết quả cũ,
  kiểm tra scope của báo cáo trước khi áp dụng.

### B. [P2] CSV vẫn xuất snapshot cũ sau lỗi tải, đồng thời nhãn chưa theo scope

- Vị trí: nút Xuất CSV trong `customer-insights-view.tsx` và hàm
  `exportInsightsCSV` trong `customer-insights-data.ts`.
- Tái hiện: ACTIVE có 9.900.000đ/1 đơn mới → chuyển COMPLETED, API trả 503
  → màn hình báo lỗi nhưng Xuất CSV vẫn bật. Tệp tải về chứa dữ liệu ACTIVE cũ.
- Tệp còn gắn nhãn “Tổng số đơn hàng hoàn thành,1” dù fixture chỉ có đơn MOI;
  các nhãn dòng timeline/doanh thu cũng chưa đổi theo ACTIVE/COMPLETED.
- Cần khóa xuất khi lỗi, gắn snapshot với scope/kỳ đã xác nhận và đổi nhãn CSV
  theo scope. Không dùng dữ liệu cũ như kết quả của bộ lọc hiện tại.

### C. [P2] Phần trăm ngành hàng không khớp phần vẽ biểu đồ

- Vị trí: `customer-insights-view.tsx`, đoạn tạo categorySlices: value lấy
  quantity_sold nhưng percentage lấy tỷ trọng revenue do backend trả.
- Tái hiện: 1 CPU giá 9.000.000đ và 9 chuột tổng 900.000đ. Cung CPU chiếm 10%
  tổng số sản phẩm nhưng chú giải/hover hiện 90,9% (tỷ trọng tiền).
- Cần dùng cùng một đại lượng cho value, percentage và nhãn: số lượng hoặc doanh số.

Các vấn đề A–C được tái hiện trước sửa và hiện đã sửa như cập nhật ở đầu mục.
Các kết quả kiểm tra và lỗi cũ sau PR #125 bên dưới được giữ làm lịch sử.

Đã pull fast-forward main từ `8b0ce43` đến `6ac3839` (commit chức năng `8a6d52e`).
Giữ nguyên các ghi chú local. Phạm vi là đối chiếu lỗi trong MAIN-REVIEW-20261108.md
và các mục trong CRM-UPDATE-CHECKLIST-20261108.md. Không sửa mã nghiệp vụ hoặc dữ liệu DB.

## Kết quả đối chiếu 6 lỗi trước đó

| Lỗi | Kết quả kiểm tra |
|---|---|
| Truy vấn chỉ lấy một trang REST | Đã dùng helper rows(), mock 1.001 khách lấy đủ qua 3 request. Chưa có order ổn định khi phân trang. |
| Bài chỉ có văn bản tự thành 5 sao | Đã sửa trường hợp này: điểm null, không tính vào CSAT. Vẫn suy diễn điểm thành phần và làm tròn trung bình quá sớm. |
| Lỗi đọc khảo sát biến thành danh sách rỗng | Đã sửa: surveys và survey_responses truyền lỗi đọc ra ngoài. |
| Nhóm tuổi rỗng lấy ma trận tổng | Đã sửa, kiểm tra browser fixtures: nhóm 18–24 không có đơn không hiện ma trận tổng. |
| ACTIVE lọc ngày đặt nhưng biểu đồ dùng ngày hoàn thành | Đã thống nhất mốc theo scope. Chưa đổi timestamp về giờ Việt Nam trước khi chia tháng/quý/năm. |
| Hover biểu đồ trỏ nhầm nhóm khi có giá trị 0 | Đã sửa bằng nhãn nhóm. Browser fixtures Nam=0/Nữ=2: hover cung Nữ hiện 2/100%. |

## Phần còn lỗi / chưa hoàn tất

### 1. [P1] Điểm sản phẩm/dịch vụ vẫn có thể là điểm suy diễn

Vị trí: `Backend/phub_api/repositories/crm_analytics.py:144`, `:160`.

Chỉ có câu hỏi hài lòng về sản phẩm, điểm 5, vẫn trả thêm diem_dich_vu=5
dù không có câu hỏi dịch vụ. Câu điểm chung hoặc thậm chí câu điểm SO_THICH
cũng có thể được dùng cho cả hai loại. Phân loại bằng từ khóa trong câu hỏi
không xác định chắc nội dung đo lường; schema hiện chỉ có CHUNG/SO_THICH/HAI_LONG.

Đã tái hiện bằng repository với bảng giả lập, không ghi DB thật. Cần để null
cho loại chưa được hỏi; xác định rõ câu nào đo HAI_LONG trước khi tính CSAT.

### 2. [P2] Trung bình khảo sát bị làm tròn thành số nguyên trước khi tổng hợp

Vị trí: `Backend/phub_api/repositories/crm_analytics.py:158`.

Hai câu điểm 5 và 4 được round(4.5) thành 4, nên tổng hợp tiếp vẫn sai.
DTO overall_score đang là int nên cần điều chỉnh đồng bộ nếu giữ điểm trung bình
thập phân. Cũng cần chốt cách tính phân bố sao: phân bố câu trả lời thực tế
khác phân bố trung bình của mỗi bài.

### 3. [P2] Biểu đồ vẫn chia tháng theo múi giờ của chuỗi timestamp

Vị trí: `Backend/phub_api/services/crm_analytics.py:208`.

Tái hiện ACTIVE: thoi_gian_dat=2026-10-31T18:00:00+00:00 tương ứng
01:00 ngày 01/11 tại Việt Nam, nhưng timeline vẫn trả tháng 10.
Cần chuẩn hóa timestamp có timezone về Asia/Ho_Chi_Minh/UTC+7 trước khi chia kỳ;
quy định rõ cách hiểu timestamp không có timezone.

### 4. [P2] Phân trang mới chưa quy định thứ tự ổn định

Vị trí: các query factory trong `Backend/phub_api/repositories/crm_analytics.py:12`
và `Backend/phub_api/repositories/pagination.py:13`.

Các truy vấn đã có range 500 dòng nhưng chưa có order bằng khóa duy nhất.
Nếu thứ tự kết quả thay đổi giữa các trang có thể trùng/bỏ sót dòng.
MockTransport đã xác nhận lấy đủ 1.001 dòng với thứ tự cố định, đồng thời xác
nhận các request không có tham số order. Chưa kết luận DB thật đang bị trùng dòng.

## Các mục checklist chưa được thực hiện trong commit mới

- Giới tính: API/schema/kiểu frontend/form hồ sơ vẫn chưa nối xuyên suốt.
  DB đã có cột và dữ liệu; không cần tự tạo lại cột.
- Migration local hỗ trợ giới tính vẫn chưa được bổ sung.
- Thông báo CRM cho khách và lịch sử thông báo đầy đủ chưa được thêm.
- Link /reviews từ báo cáo admin vẫn hướng tới nghiệp vụ thuộc nhân viên.
- Báo cáo sở thích tự khai/tổng hợp vẫn cần làm rõ với xu hướng mua hàng.
- CSV vẫn có nhãn số đơn hoàn thành khi báo cáo ở phạm vi ACTIVE.
- Hồ sơ chăm sóc tập trung và nhắc ticket quá hạn vẫn là các nâng cấp chưa thực hiện.

Các mục này là phạm vi chưa triển khai, không tính là hồi quy do PR #125.

## Kiểm tra đã chạy trên commit mới

- Backend pytest toàn bộ: **1.379 passed**, một cảnh báo deprecation có sẵn.
- Customer insights frontend unit tests: **4 passed**.
- TypeScript --noEmit: admin, staff, user đều đạt.
- OpenAPI snapshot: khớp ứng dụng.
- Các ca repository/service offline: phân trang >1.000, text-only không có điểm,
  lỗi kết nối không bị nuốt, ACTIVE/COMPLETED khác tháng, điểm thành phần suy diễn,
  làm tròn 4.5 và UTC qua ranh giới tháng.
- Browser fixtures: hover nhóm có nhóm 0 đứng trước, chuyển dạng bảng và lọc nhóm tuổi
  không có đơn; không có runtime pageerror. Chặn mọi API ghi và giả lập mọi API browser.
- Không kiểm tra deploy Render hoặc chạy migration/ghi giao dịch trên Supabase.

Chưa sửa những lỗi còn lại trong lượt kiểm tra này.

# Review main — 08/11/2026

> Đây là kết quả review tại commit `8b0ce43`. Các lỗi báo cáo trong tài liệu đã
> được xử lý qua PR #125 và các bản sửa local tiếp theo. Xem trạng thái kiểm thử
> và sửa mới nhất tại [CRM-RECHECK-20261108.md](CRM-RECHECK-20261108.md).

Đã chuyển worktree BanPC sang `main` và pull fast-forward đến `8b0ce43`
(PR #124). Bốn file ghi chú chưa được theo dõi vẫn được giữ nguyên.
Phạm vi review phần mới so với `c9b029e`: phân tích khách hàng/CRM,
điều hướng, bộ chọn sao khảo sát/đánh giá và thay đổi giao diện liên quan.
Không sửa mã nghiệp vụ, không chạy migration hay ghi dữ liệu Supabase.

## Các vấn đề cần sửa

### 1. [P1] Báo cáo có thể bị cắt dữ liệu mà không báo lỗi

- Vị trí: `Backend/phub_api/repositories/crm_analytics.py:9`, `:33`, `:69`, `:99`.
- Các truy vấn khách hàng, đơn hàng, dòng hàng và khảo sát chỉ đọc một trang;
  không dùng range, thứ tự ổn định hoặc tổng hợp ở database. Chia danh sách
  mã đơn thành nhóm 150 không bảo đảm lấy đủ các dòng trong mỗi nhóm.
- Với giới hạn REST mặc định 1.000 bản ghi, số khách/đơn/doanh số và kết quả
  khảo sát sẽ thiếu khi dữ liệu vượt giới hạn. Chưa kiểm tra giới hạn thực tế
  của project đang chạy; lỗi xảy ra khi vượt giới hạn được cấu hình.
- Xác minh offline bằng PostgREST MockTransport: 1.001 khách, trang đầu 1.000
  khách, header có tổng 1.001; repository vẫn trả 1.000 sau đúng một request.
- Sửa bằng SQL aggregate hoặc phân trang đầy đủ có thứ tự ổn định; bổ sung
  kiểm thử vượt giới hạn ở cả đơn và dòng đơn.
- Tài liệu: https://supabase.com/docs/reference/python/select

### 2. [P1] Tự gán 5 sao cho khảo sát không chấm điểm

- Vị trí: `Backend/phub_api/repositories/crm_analytics.py:135`, `:149`.
- Bài chỉ trả lời văn bản/lựa chọn vẫn được gán cả điểm tổng thể, sản phẩm
  và dịch vụ bằng 5. Service đưa các điểm này vào CSAT và khuyến nghị.
- Nhánh phân biệt `SAN_PHAM`/`DICH_VU` không khớp schema hiện có:
  `nhom_noi_dung` chỉ nhận `CHUNG`, `SO_THICH`, `HAI_LONG` trong migration
  `20261105093025_crm_surveys_reviews.sql:33`. Nhiều câu điểm cũng bị lấy
  câu cuối làm điểm chung, phụ thuộc thứ tự trả dữ liệu không được quy định.
- Xác minh offline: một bài chỉ có câu văn bản thuộc SO_THICH trả 5/5 ở cả
  ba chỉ số dù không có câu điểm nào.
- Chỉ tính điểm thật; giữ null khi không có câu điểm, không tự suy diễn
  sản phẩm/dịch vụ khi schema chưa phân biệt hai loại này.

### 3. [P2] Mất kết nối khảo sát bị hiển thị như không có dữ liệu

- Vị trí: `Backend/phub_api/repositories/crm_analytics.py:102`, `:156`.
- `except Exception: return []` nuốt cả lỗi mạng, quyền và schema. Endpoint
  vẫn trả báo cáo thành công với 0 khảo sát/phản hồi, dễ bị hiểu là số liệu thật.
- Xác minh offline: repository giả lập lỗi execute trả danh sách rỗng.
- Cần truyền lỗi đọc dữ liệu lên hoặc khai báo rõ phần báo cáo không khả dụng;
  không đổi lỗi kết nối thành số 0 hợp lệ.

### 4. [P2] Nhóm tuổi không có đơn lại hiện ma trận của toàn bộ khách

- Vị trí: `ui/adminUI/src/features/customer-insights/customer-insights-view.tsx:313`.
- Ma trận rỗng của nhóm đang chọn được thay bằng ma trận tổng vì kiểm tra
  `length > 0`. Ví dụ nhóm 18–24 có 0 đơn nhưng nhóm khác có mua CPU: bảng
  của nhóm 18–24 lại có số CPU và doanh số của toàn bộ dữ liệu.
- Fixture service đã xác nhận nhóm 18–24 có total_orders=0, matrix=[] trong
  khi ma trận tổng có dòng hàng. Điều kiện UI chọn ma trận tổng trong trường hợp này.
- Phân biệt mảng rỗng hợp lệ với trường không tồn tại; giữ trạng thái không có dữ liệu.

### 5. [P2] Lọc theo ngày đặt nhưng xếp biểu đồ theo ngày hoàn thành

- Vị trí: `Backend/phub_api/services/crm_analytics.py:200`;
  đối chiếu repository `:28`.
- ACTIVE lọc theo `thoi_gian_dat`, nhưng timeline luôn ưu tiên ngày hoàn thành.
  Fixture đơn đặt 31/01, hoàn thành 01/02, lọc ACTIVE tháng 01 trả timeline tháng 02.
  Ngay cả không lọc ngày, đơn đang mở và đơn hoàn thành cũng dùng hai mốc khác nhau.
- Chọn cùng một mốc theo status_scope và chuẩn hóa giờ Việt Nam trước khi chia kỳ.

### 6. [P2] Hover biểu đồ tròn đọc nhầm nhóm sau khi bỏ giá trị 0

- Vị trí: `ui/adminUI/src/features/customer-insights/pie-chart-svg.tsx:49`, `:90`.
- Cung SVG dùng index sau khi lọc các nhóm value=0, trong khi phần giữa biểu
  đồ và legend dùng index danh sách ban đầu. Với Nam=0, Nữ=2, hover cung Nữ
  gán index=0 rồi đọc Nam=0 và hiện 0% thay vì 2/100%.
- Dùng định danh nhóm hoặc giữ index gốc khi tạo các cung.
- Xác minh bằng render component offline với hover index=0: cung Nữ tồn tại
  nhưng chữ ở giữa là `0` và `0.0%`.

## Kiểm tra

- Toàn bộ pytest backend: **1.374 passed**, một cảnh báo deprecation có sẵn.
- `node --test ui/adminUI/tests/customer-insights.test.cjs`: **4 passed**.
- TypeScript `--noEmit`: admin, staff và user đều đạt.
- `scripts/export_openapi.py --check`: khớp snapshot.
- Build production staff đạt trong thư mục nguồn riêng tại TEMP, cài mới
  dependencies bằng `npm ci` và chạy `npm run build` (gồm prebuild adminUI).
  Đây là kiểm thử local Windows; chưa xác nhận lần deploy Render thực tế.
- Các trường hợp tái hiện ở trên dùng fixtures/MockTransport, không phải dữ liệu thật.
- Bộ test CRM hiện chủ yếu thay toàn bộ repository bằng dữ liệu đã tổng hợp;
  chưa kiểm tra phân trang và cách biến câu trả lời khảo sát thật thành chỉ số.

Ưu tiên sửa mục 1–3 trước khi dùng báo cáo CRM để kết luận số liệu;
sau đó sửa các lỗi lọc và tương tác biểu đồ ở mục 4–6.

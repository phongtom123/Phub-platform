# Nhân viên xem kết quả khảo sát và sở thích khách hàng

Chọn người nhận trực tiếp dưới Đối tượng khi soạn bản nháp:
[Tùy chỉnh danh sách người nhận](SURVEY-CUSTOM-AUDIENCE.md).

- Nhân viên vào **Tiếp thị → Khảo sát khách hàng**, bấm **Xem kết quả** trên
  khảo sát đã phát hành/đóng để mở trang riêng `/surveys/{id}/results`.
  Trang kết quả không dùng form soạn câu hỏi. Hiển thị người tạo khảo sát,
  số khách nhận, số bài đã gửi, tỷ lệ hoàn thành và hai tab:
  **Người trả lời** (tên/mã khách, tuổi hiện tại, ngày gửi, từng câu trả lời)
  và **Thống kê câu hỏi** (lựa chọn, điểm, nội dung văn bản/Khác).
  Bản nháp chưa có phản hồi; URL cũ `?id=...` (kể cả `&view=results`) chuyển tới trang mới.
- **Tiếp thị → Sở thích khách hàng** (`/interests`) dùng phản hồi đã hoàn thành
  của câu hỏi thuộc nhóm `SO_THICH`. Không suy diễn sở thích từ câu Chung,
  câu Hài lòng, đơn hàng hoặc điểm đánh giá sản phẩm.
- Lọc theo khảo sát, tìm tên/mã khách, câu hỏi hoặc nội dung trả lời. Thống kê
  áp dụng trên toàn bộ kết quả phù hợp, không chỉ trang 20 dòng đang xem.
- Mỗi dòng giữ khách, tuổi tính từ ngày sinh, câu hỏi, khảo sát nguồn và ngày
  trả lời. Nội dung Khác được giữ nguyên; không tự phân loại bằng từ khóa.
- Phân bố được tách theo từng câu hỏi/khảo sát; tối đa 6 câu hỏi có nhiều phản
  hồi nhất. Một khách có thể trả lời nhiều câu hoặc nhiều khảo sát nên số câu
  trả lời không bằng số khách duy nhất. Câu văn bản xem trong bảng chi tiết.
- Loại bài chưa gửi và hồ sơ khách đã xóa mềm. Khảo sát chưa có phản hồi vẫn
  xuất hiện trong bộ lọc và có trạng thái trống rõ ràng.
- Dữ liệu tự đọc lại theo cơ chế polling đang có; nút **Làm mới** tải lại ngay.

Quyền: ADMIN và NHAN_VIEN đọc kết quả từng khảo sát và API sở thích. Báo cáo
CRM tổng hợp vẫn dành ADMIN; tạo/sửa/phát hành/đóng khảo sát vẫn dành NHAN_VIEN.
Khách chỉ đọc/điền khảo sát của mình, không được truy cập dữ liệu tổng hợp.

API chỉ đọc:

- `GET /api/crm/surveys/{survey_id}/statistics?page=1`
- `GET /api/crm/surveys/{survey_id}/results?q=<tên hoặc mã khách>&page=1&text_page=1`
- `GET /api/crm/interests?survey_id=<uuid>&q=<tìm kiếm>&page=1`

Migration `staff_survey_results_interests` chỉ điều chỉnh quyền đọc và bổ sung
một SQL RPC tổng hợp từ các bảng hiện có; không thêm bảng và không tạo/sửa/xóa
câu trả lời của khách hàng. RPC chỉ server service_role được gọi, có kiểm tra
lại tài khoản/role hoạt động bên trong SQL.

Migration `20261109073654_survey_results_respondents.sql` bổ sung RPC chỉ đọc
cho trang kết quả riêng và danh sách người trả lời. Đã áp dụng trên Phub ngày
09/11/2026; không sửa dữ liệu khảo sát/câu trả lời đang có.

Đã áp dụng trên Supabase Phub ngày 09/11/2026, version `20261109072011`.
Kiểm tra đọc dữ liệu sau migration: 3 câu trả lời sở thích từ 2 khách, thuộc
2 khảo sát. Đây là số liệu tại thời điểm kiểm tra, không phải dữ liệu seed mới.

Kết quả chi tiết giữ người trả lời đã lưu trữ (có nhãn) để đối chiếu lịch sử
với số bài hoàn thành. Mục Sở thích chỉ tổng hợp hồ sơ chưa lưu trữ.
Tuổi trên trang kết quả tính từ ngày sinh hiện có theo ngày Việt Nam, không
phải tuổi được chốt tại ngày trả lời. Chưa có ngày sinh thì hiện “Chưa xác định”.
Tìm người trả lời không thay đổi thống kê của toàn khảo sát. Danh sách người
trả lời và nội dung văn bản được phân trang độc lập; một RPC đọc cả kết quả.

Kiểm tra có mục tiêu: `test_engagement.py` và `test_staff_workspace.py` (57 ca),
SQL `staff-survey-interests-sql.test.cjs`, browser fixtures
`staff-survey-interests.e2e.cjs`, TypeScript hai portal và gateway chỉ đọc đều đạt.
Đã đọc lại RPC bằng cấu hình backend local và kiểm tra schema phản hồi thật.

Script SQL cũ `staff-workspace-sql.test.cjs` hiện dừng ở migration
`counter_buyer_email` trước khi tới phần CRM do điều kiện tiền đề của fixture.
Script khảo sát riêng dùng chuỗi migration cần cho CRM để kiểm tra quyền,
nội dung Khác, bài hoàn thành, hồ sơ lưu trữ, bộ lọc và phân trang; không sửa
nghiệp vụ hóa đơn trong đợt này.

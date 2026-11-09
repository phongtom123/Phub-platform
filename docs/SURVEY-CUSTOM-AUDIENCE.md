# Tùy chỉnh người nhận khảo sát

Trong form soạn khảo sát, ngay dưới **Đối tượng** có **Danh sách dự kiến nhận
khảo sát**. Danh sách tự tải từ khách có tài khoản đang hoạt động và hồ sơ chưa
lưu trữ; không cần nhập tiêu đề/câu hỏi hoặc lưu bản nháp trước để xem.

- Bộ lọc Tất cả/Theo tuổi/Chưa có ngày sinh tạo danh sách nền.
- **Bỏ khỏi danh sách** loại khách khỏi lần khảo sát này.
- Mở **Thêm khách hàng vào danh sách**, tìm tên/mã và thêm khách đang hoạt động.
  Có thể thêm khách ngoài bộ lọc tuổi hoặc thiếu ngày sinh; có nhãn thêm thủ công.
- **Đặt lại thêm/bỏ** xóa các điều chỉnh, trở lại danh sách theo bộ lọc nền.
- Các lựa chọn thủ công được giữ khi đổi bộ lọc. Tìm kiếm không thay đổi tổng
  số người nhận và không tự lưu/gửi khảo sát. Mỗi danh sách phân trang 20 khách.
- Lưu bản nháp để giữ lựa chọn; khi mở lại vẫn thấy đúng cấu hình đã lưu.
- Trước phát hành vẫn kiểm tra lại danh sách/phiên bản như luồng hiện có.
  Nếu khách thêm thủ công không còn hoạt động, UI hiển thị mã để bỏ lựa chọn;
  backend chặn lưu/phát hành cho đến khi giải quyết. Tất cả thao tác ghi nằm
  trong transaction và giữ idempotency của luồng khảo sát cũ.
- Danh sách gửi được chốt trong GUI_KHAO_SAT; sau phát hành không sửa người
  nhận. Hồ sơ bị khóa/lưu trữ sau đó không làm thay đổi lịch sử danh sách gửi.

Database bổ sung hai mảng `KHAO_SAT.khach_them`, `khach_loai`, mặc định rỗng;
không thêm bảng và không tự gửi khảo sát đang có. RPC đọc trước danh sách:
`POST /api/crm/survey-audience?scope=selected|candidates&q=...&page=1`.
Body chỉ chứa loại đối tượng, khoảng tuổi và các mã thêm/bỏ. Endpoint dành
NHAN_VIEN, yêu cầu Origin hợp lệ. Hai mảng giới hạn 5.000 mã mỗi mảng, không
trùng nhau; client cũ bỏ qua hai trường vẫn giữ lựa chọn đã lưu khi cập nhật.

API/SQL cho khách trả lời không trả danh sách mã khách được thêm/bỏ của người
khác. Preview và publish dùng chung điều kiện chọn để tránh lệch danh sách.
Kiểm tra có mục tiêu gồm SQL biệt lập, API mocked, browser fixtures và TypeScript;
không tạo/phát hành khảo sát thật trong các kiểm tra này.

Đã áp dụng migration `20261109081917_survey_custom_audience.sql` trên Supabase
Phub ngày 09/11/2026. API local đã khởi động lại; kiểm tra dữ liệu thật chỉ đọc
preview, không tạo/phát hành khảo sát hay thay đổi người nhận thật.

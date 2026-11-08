# Danh sách cập nhật CRM — 08/11/2026

> Cập nhật sau các lượt sửa: CRM-01 đã xử lý các lỗi được tái hiện, gồm tính điểm,
> phân trang, múi giờ, lọc nhóm tuổi, hover, request cũ và CSV. Xem kết quả tại
> [CRM-RECHECK-20261108.md](CRM-RECHECK-20261108.md). Các mục còn lại vẫn là kế hoạch,
> chưa được triển khai chỉ vì xuất hiện trong checklist này.

Phạm vi: main `8b0ce43`, đối chiếu mục 4 CRM trong biên bản đánh giá người dùng
gửi và kiểm tra chỉ đọc Supabase PHUB. Đây là kết quả rà soát, không phải các
chức năng đã được triển khai trong lượt này. Không sửa dữ liệu hoặc áp migration.

## Dữ liệu tại thời điểm kiểm tra

- 18 hồ sơ khách hàng, cả 18 chưa xóa mềm.
- 13 hồ sơ có ngày sinh; 12 hồ sơ có giới tính. Không đồng nghĩa tất cả có tài khoản hoạt động.
- 1 khảo sát ở trạng thái DANG_MO, 11 lượt nhận, 1 lượt hoàn thành.
- Câu hỏi hiện có: 2 SO_THICH và 1 HAI_LONG.
- KHACH_HANG.gioi_tinh có sẵn, nhận NAM/NU/KHAC hoặc NULL.
- Hàm admin_update_customer_profile_v2 trên DB đã chấp nhận gioi_tinh;
  migration local chưa có thay đổi này. Cần đối chiếu và bổ sung migration tái lập
  tương thích, không chạy lại initial schema hoặc tạo cột trùng một cách mù quáng.

## A. Phần cần hoàn thiện trước khi nghiệm thu CRM

### CRM-01 — Sửa tính đúng và tính đầy đủ của báo cáo (ưu tiên cao nhất)

- [ ] Lấy đủ khách, đơn, dòng đơn và khảo sát khi vượt giới hạn REST.
- [ ] Chỉ tính điểm khảo sát thực sự được trả lời; không tự gán 5 sao.
- [ ] Không suy diễn điểm sản phẩm/dịch vụ từ nhóm câu hỏi không có phân loại đó.
- [ ] Giữ lỗi đọc dữ liệu thành trạng thái lỗi, không trả thành 0 hợp lệ.
- [ ] Nhóm tuổi không có dữ liệu phải hiện trống, không dùng ma trận tổng.
- [ ] Dùng mốc ngày thống nhất theo phạm vi ACTIVE/COMPLETED, chuẩn hóa giờ Việt Nam.
- [ ] Sửa index hover biểu đồ khi nhóm có giá trị 0.
- [ ] Đồng nhất nhãn UI và CSV: đơn có hiệu lực/tổng nhu cầu khác đơn hoàn thành/doanh thu.

Vị trí: Backend/phub_api/{repositories,services}/crm_analytics.py;
ui/adminUI/src/features/customer-insights/.
Các lỗi và cách tái hiện đã có ở MAIN-REVIEW-20261108.md.

### CRM-02 — Nối giới tính xuyên suốt database → API → UI

- [ ] Bổ sung trường vào hợp đồng đọc/ghi hồ sơ CRM và hồ sơ khách tự sửa.
- [ ] Bổ sung projection, ánh xạ service, kiểu frontend và kiểm tra phản hồi.
- [ ] Form khách và form nhân viên có Nam/Nữ/Khác/Chưa cung cấp, không bắt buộc.
- [ ] Hiển thị giới tính trong hồ sơ chi tiết; giữ nhóm chưa xác định trong báo cáo.
- [ ] Đồng bộ migration với cấu trúc DB hiện hữu, giữ nguyên dữ liệu giới tính đã có.
- [ ] Kiểm thử lưu/đọc NAM/NU/KHAC/NULL, chặn giá trị sai và giữ nguyên các trường khác.

Hiện CustomerUpdate từ chối gioi_tinh bằng extra_forbidden; CustomerProfile
hai API và CustomerProfileUpdate phía khách chưa chứa trường này. Không chỉ thiếu ô nhập.
Vị trí: Backend/phub_api/schemas/{crm,commerce}.py; repositories/{crm,commerce}.py;
services/commerce.py; ui/adminUI/src/lib/customer-profile.ts;
ui/adminUI/src/features/customers/; ui/userUI/Frontend/src/lib/account/client.ts;
ui/userUI/Frontend/src/app/main/profile/.

### CRM-03 — Làm rõ sở thích tự khai và mức hài lòng

- [ ] Giữ báo cáo đáp án từng câu SO_THICH/HAI_LONG hiện có.
- [ ] Thể hiện rõ sở thích do khách khai qua khảo sát và xu hướng mua từ đơn hàng.
- [ ] Không lấy sản phẩm bán chạy thay cho kết quả khảo sát sở thích.
- [ ] Chỉ dùng điểm câu phù hợp để kết luận hài lòng; hiện chưa có dữ liệu khi chưa ai chấm.
- [ ] Trong báo cáo admin, cho tìm/chọn khảo sát nhu cầu hoặc hài lòng để xem kết quả.

Không nhất thiết thêm lại bảng SO_THICH đã được bỏ trước đây; có thể dùng các bảng
khảo sát và câu trả lời hiện hữu. Mẫu khảo sát sản phẩm mới có thể thực hiện bằng
các loại câu hiện có, chưa cần thiết kế bảng riêng chỉ để đạt mục tiêu đề bài.

### CRM-04 — Rà lại điều hướng và phân quyền

- [ ] Bỏ hoặc thay link /reviews trên báo cáo admin: màn quản lý đánh giá thuộc nhân viên.
- [ ] Admin xem báo cáo/kết quả và quản lý tài khoản; không mở lại quyền nghiệp vụ ngoài yêu cầu.
- [ ] Nhân viên quản lý hồ sơ, tiếp nhận hỗ trợ, vận hành khảo sát/đánh giá.
- [ ] Khách chỉ đọc/sửa hồ sơ, ticket, đánh giá và bài khảo sát thuộc mình.
- [ ] Đồng nhất nhãn chức năng/hướng dẫn với vai trò hiện tại; tài liệu cũ còn dùng tên Admin cho nghiệp vụ nhân viên.

Vị trí: ui/shared/internal-access.ts; ui/adminUI/src/features/engagement/crm-report-view.tsx;
Backend/phub_api/dependencies/ và services/ liên quan.

### CRM-05 — Kiểm thử và chuẩn bị nghiệm thu

- [ ] Luồng hồ sơ: thêm → sửa thông tin/ngày sinh/giới tính → khóa tài khoản → xóa mềm/khôi phục.
- [ ] Luồng khảo sát: tạo nháp → xem trước → phát hành → đúng khách nhận → trả lời → thống kê.
- [ ] Luồng hỗ trợ: khách gửi → nhân viên nhận xử lý/trả lời → khách xem đủ lịch sử.
- [ ] Luồng đánh giá: đúng khách đã mua → gửi/sửa → nhân viên xem theo sản phẩm → ẩn/hiện.
- [ ] Test riêng dữ liệu vượt một trang REST, chưa có câu điểm, lỗi API, dữ liệu rỗng và sai role.
- [ ] Kiểm thử liên kết UI bằng fixtures trước; thử ghi thật phải được người dùng cho phép.
- [ ] Ghi rõ dữ liệu demo/thật và giới hạn kiểm thử; không tự điền thông tin cá nhân còn thiếu.

## B. Nâng cấp nên làm thêm (không phải tất cả đều bắt buộc trong đề bài)

### CRM-06 — Trung tâm thông báo CRM

- [ ] Khách: nhận khảo sát mới, có phản hồi/tin nhắn hỗ trợ.
- [ ] Nhân viên: có ticket/tin nhắn mới, đánh giá thấp cần xem.
- [ ] Mỗi người có trạng thái đọc, số chưa đọc, đọc tất cả và lịch sử riêng.
- [ ] Mở đúng bản ghi theo quyền; không lộ nội dung của khách khác.
- [ ] Sự kiện được tạo cùng giao dịch nghiệp vụ, thử lại không tạo thông báo trùng.
- [ ] Cập nhật khi cửa sổ đang dùng theo cơ chế có giới hạn; không tải liên tục vô hạn.

Hiện chuông chỉ có ở portal staff; feed đọc từ đơn MOI/tồn thấp/ticket MOI,
có lưu dấu đã đọc nhưng chưa có hộp thư CRM cho khách hoặc lịch sử sự kiện đầy đủ.
Vị trí: ui/adminUI/src/features/operations/header-tools.tsx; components/admin/header.tsx;
Backend/phub_api/controllers/admin_operations.py; migrations/20261028132157_admin_operations.sql.

### CRM-07 — Hồ sơ chăm sóc khách tập trung

- [ ] Giữ hồ sơ, tài khoản liên kết và lịch sử đơn đang có.
- [ ] Bổ sung các mục ticket, đánh giá và khảo sát đã trả lời của chính khách đang xem.
- [ ] Nếu thêm ghi chú nội bộ: lưu người ghi/thời điểm, chỉ nhân viên được xem.
- [ ] Nối liên kết giữa các màn thay vì sao chép lại dữ liệu giao dịch.

### CRM-08 — Theo dõi hiệu quả xử lý hỗ trợ

- [ ] Giữ trạng thái, ưu tiên, nhận xử lý và hội thoại đang có.
- [ ] Bổ sung hạn phản hồi, danh sách quá hạn và nhắc ticket chờ lâu.
- [ ] Phân biệt đang chờ khách với đang chờ nhân viên.
- [ ] Đo thời gian phản hồi đầu tiên và thời gian giải quyết từ lịch sử thật.

## Thứ tự thực hiện đề xuất

1. CRM-01 và CRM-02: sửa số liệu, hoàn thiện dữ liệu hồ sơ/migration.
2. CRM-03 và CRM-04: làm rõ báo cáo, điều hướng đúng vai trò.
3. CRM-05: nghiệm thu các yêu cầu cốt lõi.
4. CRM-06: bổ sung thông báo CRM.
5. CRM-07/08: mở rộng chăm sóc khách và theo dõi xử lý.

Khi triển khai: kiểm thử local trước, cập nhật SQL nếu cần rồi deploy API/UI
cùng phiên bản hợp đồng. Không push, deploy hay sửa DB trong lượt rà soát này.

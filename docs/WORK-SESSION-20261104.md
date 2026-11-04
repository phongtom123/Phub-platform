# PHUB — Review main và công việc phiên 04/11/2026

## Mốc mã và phạm vi review

- Đã chuyển từ `feat/backend-middleware-api` sang `main`, pull bằng fast-forward.
- Main local = `origin/main` tại `03edc23089496d96843a80bd2643fc7f63bdace1` (PR #109).
- So với mã đã làm gần nhất `dd46b50`, có 42 file thay đổi, 1.776 dòng thêm và 37 dòng bỏ. Phần triển khai mới chính nằm ở commit `b9edaeb`.
- Worktree sạch trước khi pull; không có xung đột hoặc thay đổi local cần ghi đè.
- Review mã mới và kiểm thử có mục tiêu trên local/fixtures; không xác nhận bản Render hoặc schema Supabase đang chạy, không ghi dữ liệu nghiệp vụ thật.

## Main đã bổ sung gì

1. API ADMIN `GET /api/admin/orders/{order_id}/detail`, theo cấu trúc controller/service/repository. Trả đơn, khách, nhân viên, dòng hàng, hóa đơn, thanh toán, voucher và tổng tiền bằng Decimal.
2. Trang chi tiết đơn dùng API tổng hợp, giảm đọc lẻ thông tin khách/nhân viên và có khối tổng hóa đơn/đã thu/đã hoàn/còn phải thu. Cache được cách ly theo phiên và xóa khi ghi.
3. Phiếu nhập có autocomplete sản phẩm/NCC: tìm theo tên, mã/SKU, phân trang, chọn bằng bàn phím và menu nổi trên màn hình hẹp. API NCC hỗ trợ tìm chính xác mã số nguyên.
4. Chỉnh nút xuất CSV, liên kết báo cáo, kiểm tra URL chuyển khách từ Admin để tránh chuyển về chính ứng dụng Admin.
5. Bổ sung tài liệu API chi tiết đơn, checklist Admin trong repo và các kiểm thử mới.

KAN-55 hiện đã có API thật, không còn hoàn toàn là endpoint dự kiến như bản đối chiếu trước khi pull. Tuy nhiên chưa đủ toàn bộ tiêu chí KAN-55: API chưa trả lịch sử thao tác, tồn vật lý/đang giữ/khả dụng hoặc danh sách thao tác được phép kèm lý do.

## Phát hiện review

### P2 — Cập nhật thanh toán làm mất form nghiệp vụ chưa lưu

- Vị trí: `ui/adminUI/src/features/orders/order-financial-summary.tsx:31`, `ui/adminUI/src/components/backend-data-view.tsx:120`, `:177`, `:291`.
- Tái hiện bằng Playwright với API fixtures chỉ đọc: mở đơn, chọn **Ghi nhận hoàn tiền**, nhập số tiền `12.34` và mã đối soát `REVIEW-DRAFT`, rồi bấm **Cập nhật thanh toán** ở khối tóm tắt.
- Kết quả: toàn bộ khối chi tiết chuyển qua trạng thái loading; `OperationPanel` bị unmount. Khi dữ liệu trở lại, form đã đóng và các giá trị nháp mất.
- Nguyên nhân: callback refresh tăng version, effect xóa metadata/result và dựng lại toàn bộ nội dung; nút cập nhật vẫn dùng được khi form đang mở.
- Hướng sửa: revalidate dữ liệu của đúng đơn mà không xóa cây giao diện đang có; giữ form, giá trị nháp và cuộn. Trong khi đang gửi nghiệp vụ cần tránh đọc cũ ghi đè kết quả mới. Chặn nút cập nhật chỉ là biện pháp tạm, chưa đáp ứng đầy đủ KAN-62.
- Nghiệm thu: refresh thành công/thất bại không làm mất form thu/hoàn/phân công; lỗi không biến thành số dư 0 và không tự gửi lại thao tác ghi.

### Các phần còn thiếu so với checklist, không coi là lỗi mới đã chứng minh

- API đã lấy `lines`, `invoice`, `payments`, `voucher_uses`, nhưng trang đơn mới dùng thông tin đơn/người và khối tổng tiền. Sản phẩm, hóa đơn và giao dịch vẫn đi qua liên kết hồ sơ liên quan (`order-detail.tsx:120`), chưa xử lý trọn một đơn trên một trang.
- Thanh thao tác vẫn chủ yếu lọc theo trạng thái ở frontend; chưa dùng kết quả `allowed_actions` từ backend, chưa ẩn nút lập hóa đơn khi hóa đơn đã có ngay từ khối tóm tắt. Các transaction ghi vẫn kiểm tra lại nghiệp vụ; không kết luận từ đây rằng đã ghi trùng tiền/hóa đơn.
- API tổng hợp đọc nhiều query riêng. Tài liệu đã nêu không có snapshot transaction; kiểm tra phân trang không phát hiện mọi cập nhật đồng thời giữ nguyên số dòng. Khi bổ sung điều kiện thao tác/tồn, cần quyết định cách đọc nhất quán hoặc version, và luôn kiểm tra lại khi ghi.
- Checklist mới đưa vào repo vẫn thiếu điều kiện chỉ giữ hàng khi đơn xử lý có hóa đơn hoặc khoản thu thành công. Không thay chính sách đã chốt trong AGENTS.md để khớp tài liệu cũ.
- Bộ ba số tồn trên Admin/Kho và cơ chế hết hạn giữ đơn vẫn chưa được bổ sung trong nhóm commit vừa pull.

## Danh sách được giao — đã thu hẹp theo yêu cầu

Đã truy vấn lại Jira ngày 04/11/2026 với `project = KAN AND assignee = currentUser()`. Tài khoản hiện tại là **Hoang T**: 11 ticket được giao, trong đó KAN-11 đã Done và 10 ticket chưa Done. Chỉ những ticket được giao này mới là phạm vi thực hiện; trạng thái Jira chưa đủ để kết luận mã đã hoàn tất hay chưa.

**Đối chiếu mã thực tế bổ sung:** xem [ASSIGNED-CODE-AUDIT-20261104.md](ASSIGNED-CODE-AUDIT-20261104.md). KAN-16/52 đã có phần triển khai chính; KAN-17/19 có API nhưng UI kho còn cắt ở 100 dòng; KAN-60 thiếu bộ ba tồn riêng; chưa có cơ chế KAN-61 hoặc bộ sequence Admin KAN-36 trong repo. Bắt đầu bằng thiếu sót đã xác nhận, không thực hiện lại toàn bộ tiêu đề ticket. Các mục dưới đây cần được đọc cùng bằng chứng trong bản audit này.

### Ưu tiên phiên này: kho và định giá

- [ ] **1. [KAN-52](https://pc-seller-platform.atlassian.net/browse/KAN-52) — In Progress, Highest.** Rà phần định giá trên phiếu nhập đã có: backend tính giá, Decimal/làm tròn, quyền sửa markup/thuế, snapshot đầu vào và xác nhận cập nhật giá đúng một lần. Liệt kê và xử lý phần còn thiếu theo phương án phiếu nhập hiện tại; không tạo lại bảng thuế/cấu hình trên sản phẩm đã bỏ.
- [ ] **2. [KAN-63](https://pc-seller-platform.atlassian.net/browse/KAN-63) — To Do, Medium.** Chốt/ghi nhận kho vận hành và quyền xuất theo yêu cầu hiện hành. Checkout vẫn gom mọi kho hoạt động; đợt nhập kho 1 không khóa hệ thống vào kho đó. Không chuyển tồn/chứng từ hoặc mở chức năng chuyển kho.
- [ ] **3. [KAN-19](https://pc-seller-platform.atlassian.net/browse/KAN-19) — To Do, High; [KAN-60](https://pc-seller-platform.atlassian.net/browse/KAN-60) — In Progress, High.** Rà API tra cứu tồn theo kho/SKU, phân trang, lọc sắp hết và giới hạn kho theo quyền. Bổ sung bộ ba tồn vật lý/đang giữ/khả dụng trên API/UI thuộc phạm vi hai ticket; dùng lại một cách tính đúng điều kiện hóa đơn hoặc khoản thu thành công. Kiểm tra nhiều kho, hủy trước xuất, chống giữ/trừ hai lần và tranh tồn bằng fixtures/DB biệt lập.
- [ ] **4. [KAN-61](https://pc-seller-platform.atlassian.net/browse/KAN-61) — In Progress, High.** Chốt thời lượng, trạng thái đủ điều kiện, mốc bắt đầu và chính sách thanh toán chờ/một phần trước khi bật hết hạn. Sau đó làm tác vụ có khóa, chạy lại an toàn và xử lý tranh chấp với thanh toán; không tự đặt TTL hoặc tự hủy đơn đã thu tiền.

Danh sách trên là thứ tự đề xuất theo mối liên quan và phụ thuộc, không phải cam kết cả bốn nhóm sẽ hoàn tất trong một lượt. Nếu cần thay đổi contract do người khác phụ trách, ghi rõ điểm tích hợp thay vì tự mở rộng sang triển khai toàn bộ ticket của họ.

### Các ticket khác vẫn được giao cho Hoang T

- [ ] **[KAN-17](https://pc-seller-platform.atlassian.net/browse/KAN-17) — To Do, Highest:** rà/nghiệm thu tạo, cập nhật, trạng thái, tìm kiếm và phân trang NCC; kiểm tra NCC hợp lệ trước lập phiếu nhập. Tận dụng API hiện có, chỉ xử lý thiếu sót được xác nhận.
- [ ] **[KAN-16](https://pc-seller-platform.atlassian.net/browse/KAN-16) — In Discussion, Medium:** rà/nghiệm thu loại SP, SP/SKU, gallery, validation, tìm kiếm/lọc/phân trang và Swagger; phần mã và gallery đã làm cần được đối chiếu tiêu chí trước khi chuyển trạng thái.
- [ ] **[KAN-36](https://pc-seller-platform.atlassian.net/browse/KAN-36) — In Progress, Highest:** sơ đồ tuần tự chức năng Quản trị, bám use case/đặc tả/luồng hiện tại, thực hiện bằng draw.io theo ticket.
- [ ] **[KAN-39](https://pc-seller-platform.atlassian.net/browse/KAN-39) — In Discussion, Highest:** chốt nghiệp vụ, ERD, ma trận quyền và hợp đồng API CRM; đánh dấu quyết định còn thiếu trước khi nghiệm thu phần phụ thuộc.
- [ ] **[KAN-40](https://pc-seller-platform.atlassian.net/browse/KAN-40) — Testing, Highest:** kiểm thử migration CRM/DBML, constraint, metadata, backup/restore và rollback theo phạm vi đã duyệt; trạng thái Testing không phải chỉ thị tự chạy migration trên Supabase thật.

**[KAN-11](https://pc-seller-platform.atlassian.net/browse/KAN-11) đã Done:** không đưa vào danh sách phải làm lại.

### Phát hiện thuộc người khác

Lỗi refresh mất nháp được giữ trong phần review để tham khảo, nhưng **không nằm trong danh sách sửa của phiên này**: KAN-62 được giao cho vobao182. Các phần triển khai của KAN-55/56/58/59/64 cũng đã được loại khỏi danh sách thực hiện. Không thay assignee, trạng thái Jira hoặc tự nhận thêm ticket trong lượt cập nhật kế hoạch.

## Kiểm tra đã chạy trong lượt review

- [x] Pull main fast-forward, HEAD và origin/main bằng nhau tại mốc trên.
- [x] Backend: **401 test đạt** trong `test_admin_order_detail`, `test_platform_api`, `test_openapi`, `test_architecture` (MockTransport/fixtures, không dùng DB thật).
- [x] OpenAPI snapshot khớp ứng dụng.
- [x] Admin TypeScript `tsc --noEmit` đạt.
- [x] Cache/URL chuyển portal: **31 test Node đạt**.
- [x] Gateway dùng chung: **21 test Node đạt**.
- [x] Browser: khối tổng tiền đúng, đầy đủ tiền/chưa có hóa đơn/lỗi/thử lại và màn hình hẹp; autocomplete sản phẩm/NCC trên desktop/mobile đều đạt.
- [x] Browser fixtures tái hiện riêng lỗi refresh mất form hoàn tiền. Không gửi thao tác ghi tới server thật.

Admin local được khởi chạy ở `http://localhost:3000` để chạy browser fixtures. Không khởi động backend hoặc website khách trong lượt review này. Chưa sửa mã ứng dụng, chưa đổi Jira, chưa chạy migration và chưa push Git; file kế hoạch này là đầu ra mới của lượt review.

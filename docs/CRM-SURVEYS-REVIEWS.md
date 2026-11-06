# Khảo sát, báo cáo CRM và đánh giá sản phẩm — 05/11/2026

## Viết ngay trên trang sản phẩm — 06/11/2026

- Nút “Viết đánh giá” mở form chấm sao/nhận xét ngay trong khối đánh giá, không
  điều hướng sang trang khác. Đánh giá cũ của khách được tải vào form để sửa.
- Chỉ kiểm tra phiên và quyền mua khi khách bấm nút. Khách chưa đăng nhập nhận
  thông báo và liên kết đăng nhập; chưa có đơn hoàn thành cho sản phẩm thì báo
  chưa đủ điều kiện. Lỗi API được báo riêng, không hiểu nhầm là chưa mua.
- `GET /api/customer/crm/reviews/eligible?product_id=SP001` lọc đúng một sản phẩm
  tại database, không duyệt mọi trang lịch sử. Bỏ query vẫn giữ danh sách cũ.
- Migration `20261106074941_product_review_eligibility_filter.sql` đã áp dụng
  trên Supabase; chỉ cập nhật hàm đọc, không sửa đánh giá hoặc giao dịch.
- Gửi/sửa thành công làm mới nhận xét, số lượng và điểm sao tại chỗ; lỗi giữ
  bản nháp; đổi phiên đóng form để tránh giữ thông tin tài khoản cũ.
- Kiểm tra có mục tiêu: SQL biệt lập, 18 ca API, browser fixtures khách chưa
  đăng nhập/chưa mua/lỗi API/gửi và sửa trên desktop/mobile, không điều hướng.
  Browser ghi bằng fixtures, không tạo thêm nhận xét thật. Mã mới chưa push/deploy.

## Hiển thị ngay — chính sách mới nhất 06/11/2026

- Bỏ bước chờ duyệt. Đánh giá mới và sửa đánh giá đang hiển thị được công khai ngay;
  điểm sao cập nhật theo nội dung mới. Chỉ còn trạng thái `HIEN_THI` và `AN`.
- Quản trị viên được ẩn/hiển thị lại. Đánh giá bị ẩn không tự hiện lại khi khách sửa.
  Vẫn giữ một đánh giá/khách/sản phẩm, xác minh đơn hoàn thành và kiểm tra phiên bản.
- Migration `20261106071019_immediate_product_reviews.sql` đã áp dụng trên Supabase.
  Bốn nhận xét mẫu cũ đã chuyển từ chờ duyệt sang hiển thị; giữ nguyên nhãn
  `[DỮ LIỆU MẪU]`, nội dung, mã đánh giá, sản phẩm và đơn chứng minh mua.
- Đã kiểm tra API công khai local: SP001/SP003 trả 1 đánh giá, trung bình 4 sao.
  SQL biệt lập kiểm tra tạo/sửa hiện ngay, ẩn/hiện lại, không thể né ẩn bằng cách sửa;
  17 ca API và browser fixtures desktop/mobile qua. Cần deploy Render sau khi merge mã.

## Quy tắc hiện hành — một đánh giá cho mỗi khách/sản phẩm (06/11/2026)

- `DANH_GIA_SAN_PHAM` có `UNIQUE (ma_kh, ma_sp)`. Khách mua cùng sản phẩm nhiều lần
  vẫn dùng một đánh giá, có thể sửa số sao/nội dung. Khách khác được đánh giá riêng.
- `ma_donhang` giữ nguyên đơn chứng minh mua khi tạo đánh giá, không nằm trong khóa
  duy nhất và không bị đổi sang đơn mua lại khi sửa.
- API danh sách gộp các lần mua cùng sản phẩm thành một dòng. Gửi nội dung khác khi
  đã có đánh giá phải có `expected_version` hiện tại; phiên bản cũ trả 409.
  Sửa thành công giữ mã đánh giá, hiển thị ngay nếu chưa bị ẩn; không đưa về chờ duyệt.
- Migration `20261106070214_unique_customer_product_review.sql` đã áp dụng trên
  Supabase Phub. Không thêm bảng và không xóa/gộp dữ liệu ngầm: nếu có đánh giá trùng
  trước nâng cấp, migration dừng để đối chiếu. Bốn đánh giá mẫu được giữ nguyên,
  đã kiểm tra số lượng và checksum dữ liệu trước/sau.
- Đã kiểm tra SQL biệt lập cho mua lại, sửa, retry, phiên bản cũ, chặn INSERT trùng
  và hai khách cùng sản phẩm; 17 ca API và browser fixtures 1440px/390px qua.
  Cần deploy Render sau khi merge mã.

## Cập nhật 06/11/2026 — đánh giá sau mua trên web khách

- Thêm lối vào đánh giá từ lịch sử đơn trong hồ sơ và chi tiết đơn, chỉ khi đơn
  `HOAN_THANH`. Trang `/main/reviews` cho chấm 1–5 sao, gửi/sửa nhận xét và xem trạng thái hiển thị.
- Mở local User `http://localhost:3000`, nối backend local `http://127.0.0.1:8000`.
- Theo yêu cầu chủ hệ thống, đã thêm dữ liệu mẫu trên Supabase thật cho mọi khách
  active đủ điều kiện: 11 tài khoản active, chỉ 2 tài khoản có đơn hoàn thành.
  `TONn`: 3 đánh giá (SP003, SP004, SP006); `yeet1`: 1 đánh giá (SP001).
- Cả 4 nhận xét ghi rõ `[DỮ LIỆU MẪU]`, 4 sao; không phải trải nghiệm thực tế được
  khách gửi. Ban đầu chờ duyệt, nay đã hiển thị theo chính sách mới ở đầu tài liệu.
  Không sửa đơn, thanh toán hoặc tồn.
  Không tạo đánh giá cho 9 tài khoản chưa có đơn hoàn thành.
- Script `Backend/scripts/seed_customer_reviews.sql` gọi RPC nghiệp vụ hiện có,
  bỏ qua đánh giá đã tồn tại; không phải migration và không được tự chạy khi deploy.
- Kiểm tra trình duyệt bằng fixtures ở 1440px/390px: nút đánh giá chỉ hiện với đơn
  hoàn thành; lỗi giữ nội dung; thử lại/gửi/sửa hiển thị ngay; không tràn ngang.
  API ghi trong trình duyệt đều giả lập; phần seed và đối chiếu RPC là dữ liệu Supabase thật.
- Backend, User và Admin cần deploy cùng nhau sau khi merge; Supabase đã nâng cấp.

## Trạng thái triển khai

- Đã có migration, API theo Controller → Service → Repository và giao diện Admin/User.
- Migration `Backend/migrations/20261105093025_crm_surveys_reviews.sql` đã áp dụng
  trên Supabase **Phub** (`btfhahnjydaiivvcqnna`), cùng version trong lịch sử remote.
- Migration bổ sung index FK ghép `20261105093601_survey_answer_recipient_index.sql`
  cũng đã áp dụng sau khi đối chiếu performance advisors; không thêm bảng.
- Thêm đúng 6 bảng; schema public tăng từ 23 lên 29. Không tạo bảng lưu báo cáo hoặc tuổi.
- Không seed/gửi khảo sát hoặc ghi đánh giá cho khách thật trong quá trình triển khai.
- Kiểm tra chỉ đọc sau migration: danh sách khảo sát và đánh giá trống; 18 hồ sơ
  đang sử dụng đều chưa điền ngày sinh. Đối tượng theo tuổi cần bổ sung ngày sinh thật trước khi gửi.
- Cổng local: Admin 3001, User 3000, API 8000. Backend và các UI cần deploy lên Render sau khi merge.

## Các bảng và liên kết

| Bảng | Vai trò |
|---|---|
| KHAO_SAT | Tiêu đề, mô tả, thời hạn, đối tượng tuổi, trạng thái, người tạo và phiên bản |
| CAU_HOI_KHAO_SAT | Câu hỏi bắt buộc/tùy chọn; chọn một đáp án, điểm 1–5 hoặc văn bản |
| LUA_CHON_KHAO_SAT | Các lựa chọn Admin soạn, tối đa một lựa chọn cho phép nhập Khác mỗi câu |
| GUI_KHAO_SAT | Khách nhận thực tế, ngày gửi, hoàn thành và khóa chống nộp trùng |
| TRA_LOI_KHAO_SAT | Kết quả từng câu của một lượt gửi; điểm, lựa chọn hoặc văn bản/Khác |
| DANH_GIA_SAN_PHAM | Nhận xét 1–5 sao của sản phẩm trong đơn hoàn thành, trạng thái hiển thị/ẩn và phiên bản |

Các FK ghép ở TRA_LOI_KHAO_SAT buộc lượt gửi, câu hỏi và lựa chọn cùng khảo sát/câu hỏi.
Không sao chép hồ sơ, đơn hàng hoặc hóa đơn vào bảng mới. DBML đã đồng bộ cấu trúc.

## Luồng Admin

Trong menu **Tiếp thị**:

- `/surveys`: tạo bản nháp, soạn tối đa 30 câu, tối đa 20 đáp án/câu chọn một.
  Chọn nhóm câu **Nhu cầu / sở thích**, **Mức hài lòng** hoặc **Chung** để tổ chức báo cáo.
- Đối tượng gồm tất cả tài khoản khách hoạt động, khoảng tuổi 0–130 (hai đầu đều bao gồm)
  hoặc khách chưa cung cấp ngày sinh. Không gửi cho hồ sơ xóa mềm/tài khoản không hoạt động.
- Tuổi tính tại ngày Việt Nam khi xem trước/phát hành. Tuổi 29/02 tăng vào 01/03 trong năm không nhuận.
- **Lưu bản nháp → Xem trước khách nhận → Phát hành và gửi**. Backend kiểm tra lại phiên bản,
  điều kiện khách và thời hạn trong transaction. Danh sách được chốt khi gửi, không thay đổi theo tuổi/hồ sơ sau này.
- Sau phát hành không sửa câu hỏi hoặc đối tượng. Có thể xem danh sách đã nhận, thống kê hoặc đóng khảo sát.
- Thống kê có số đã gửi/hoàn thành, tỷ lệ hoàn thành, phân bố đáp án/điểm, trung bình và nội dung văn bản/Khác.
  Nội dung văn bản phân trang 20 dòng/câu. Không có câu trả lời thì không tạo điểm trung bình giả.
- `/reviews`: lọc tất cả/hiển thị/ẩn, ẩn hoặc hiển thị lại đúng phiên bản nhận xét hiện tại.
- `/crm-report`: nhóm tuổi gồm cả chưa có thông tin, phân bố đánh giá đang hiển thị,
  số đánh giá hiển thị/ẩn và liên kết khảo sát nhu cầu/sở thích. Kết quả sở thích xem theo từng câu khảo sát,
  không suy đoán sở thích từ hàng đã mua. Tuổi/hồ sơ là trạng thái tại ngày báo cáo, không phải báo cáo lịch sử.

## Luồng khách

- Từ `/main/profile` mở **Khảo sát của tôi** (`/main/surveys`) hoặc **Đánh giá sản phẩm đã mua** (`/main/reviews`).
- Khách chỉ xem khảo sát được gửi cho hồ sơ của mình. Chọn Khác sẽ hiện ô nhập bắt buộc;
  câu văn bản dùng cùng trường noi_dung. Chọn đáp án thông thường không gửi nội dung Khác cũ.
- Nộp toàn bộ bài trong một transaction. Thiếu câu bắt buộc, đáp án khác câu/khảo sát,
  điểm ngoài 1–5 hoặc quá hạn đều bị chặn và không lưu nửa bài.
- Gửi thành công thì khóa bài và cho xem kết quả đã gửi. Mã submission_id và nội dung
  được giữ khi thử lại sau lỗi mạng; gửi lại cùng bài không tăng số người hoàn thành.
- Danh sách đánh giá chỉ lấy sản phẩm thuộc đơn HOAN_THANH của khách. Các dòng cùng SKU
  tách kho được gộp thành một cơ hội đánh giá cho sản phẩm trong một đơn.
- Một khách có tối đa một đánh giá/sản phẩm, kể cả mua ở nhiều đơn. Cho sửa nhận xét của mình;
  nội dung sửa hiển thị ngay; nếu đã bị quản trị viên ẩn thì vẫn giữ ẩn.
- Trang chi tiết sản phẩm desktop/mobile hiển thị nhận xét chưa bị ẩn, điểm trung bình,
  phân bố 1–5 sao và phân trang. Không công khai mã khách, mã đơn, email hay người duyệt.
- Tên khách/nhận xét hiển thị ngay khi gửi; biểu mẫu thông báo điều này trước khi gửi.
- Gửi khảo sát là giao vào tài khoản trong website; không gửi email/SMS. Chưa có chọn nhiều đáp án hoặc ảnh đánh giá.

## API

| Phạm vi | Endpoint |
|---|---|
| Admin | GET/POST `/api/crm/surveys` |
| Admin | GET/PUT `/api/crm/surveys/{id}` |
| Admin | GET `/api/crm/surveys/{id}/preview?page=1` |
| Admin | POST `/api/crm/surveys/{id}/publish` và `/close` |
| Admin | GET `/api/crm/surveys/{id}/statistics?page=1` |
| Admin | GET `/api/crm/report` |
| Admin | GET `/api/crm/reviews?status=HIEN_THI&page=1` (hoặc `AN`, bỏ status để xem tất cả) |
| Admin | POST `/api/crm/reviews/{id}/moderate` |
| Khách | GET `/api/customer/crm/surveys` và `/surveys/{id}` |
| Khách | POST `/api/customer/crm/surveys/{id}/submit` |
| Khách | GET `/api/customer/crm/reviews/eligible?page=1` (thêm `product_id` để kiểm tra một sản phẩm) |
| Khách | POST `/api/customer/crm/reviews` |
| Công khai | GET `/api/catalog/products/{product_id}/reviews?page=1` |

DTO và ví dụ kiểu nằm trong `Backend/phub_api/schemas/engagement.py`, đặc tả đầy đủ tại `/docs` và `Backend/docs/openapi.json`.
Tạo nháp nhận request_id UUID để thử lại không trùng. Sửa/phát hành/đóng/ẩn/hiện lại nhận expected_version;
phiên bản cũ trả 409 và giữ nội dung để người dùng đối chiếu. Không tự retry thao tác ghi bằng ID mới.

## Phân quyền, triển khai và kiểm tra

- Mọi bảng mới bật RLS, không cấp quyền trực tiếp cho anon/authenticated. RPC SECURITY INVOKER,
  chỉ service_role được gọi; mỗi use case kiểm tra lại tài khoản/role hoặc chủ hồ sơ tại DB.
- API ghi kiểm tra Origin; danh tính lấy từ phiên, không nhận mã khách do frontend tự chọn.
- Publish khóa khảo sát và các hồ sơ/tài khoản được chọn; submit khóa khảo sát/lượt nhận;
  ẩn/hiện nhận xét kiểm tra phiên bản để tránh thao tác nhầm nội dung khách vừa sửa.
- Các tổng số/điểm do SQL tổng hợp. Giao diện chỉ tính tỷ lệ hiển thị từ số đếm đã được backend trả về.
- Advisors: 6 bảng mới phát sinh INFO RLS không có policy vì chỉ backend có quyền.
  Không có cảnh báo SECURITY DEFINER mới. Cảnh báo cũ về `public.rls_auto_enable()` nằm ngoài phạm vi:
  [hướng xử lý quyền gọi hàm](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- Deploy backend và hai UI cùng `ui/shared/backend-route.ts`; database đã được nâng cấp,
  không chạy lại initial schema hoặc migration trên project này.
- Khi demo hai vai trò cùng localhost, dùng hai browser profile/cửa sổ riêng tư để tránh thay cookie tài khoản giữa các port.

Kiểm tra tập trung đã thực hiện:

- `Backend/tests/engagement-sql.test.cjs`: PostgreSQL PGlite biệt lập; RLS/quyền, tuổi,
  danh sách cố định, gửi thử lại, Khác/câu bắt buộc/rollback, đúng chủ đơn, gộp dòng SKU,
  ẩn/hiện đúng phiên bản, nội dung sửa hiện ngay và dữ liệu công khai không lộ mã đơn/khách.
- `Backend/tests/test_engagement.py`: 17 trường hợp HTTP/RPC bằng MockTransport, không ghi DB thật.
- `ui/adminUI/tests/engagement.e2e.cjs`: trình duyệt fixtures cho Admin/User; lỗi giữ nội dung,
  phát hành, Khác, nộp bài, thống kê, đánh giá/ẩn/hiện lại, nhận xét công khai và mobile không tràn ngang.
  Phần SSR sản phẩm chỉ đọc một sản phẩm đang hiển thị trong catalog thật; mọi API ghi đều giả lập.
- TypeScript kiểm tra các nhánh Admin/User được thay đổi; đã xuất lại OpenAPI. Không chạy toàn bộ bộ test/build.

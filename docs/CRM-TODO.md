# Kế hoạch phát triển CRM trên nền Phub

> Cập nhật 23/10/2026: người dùng bỏ chức năng sở thích. Đã xóa `SO_THICH` và
> `KHACH_HANG_SO_THICH` trên project Phub sau sao lưu; các mục sở thích bên dưới
> chỉ còn là lịch sử, không thuộc backlog đang thực hiện. Giữ hồ sơ khách/ngày sinh,
> lịch sử đơn, ticket và các bảng kho. Xem [phạm vi hiện tại](CRM-ADMIN-PROFILE.md).

Ngày lập: 22/10/2026. Mốc mã đối chiếu: `01c4f9e`.

Trạng thái: **đã có mã Admin CRM đợt 1; chưa áp dụng migration lên Supabase thật trong phiên làm việc này**.

Cập nhật đợt 1 Admin: mã đã có hồ sơ CRM tại URL khách hàng cũ, ngày sinh/sở thích,
tài khoản liên kết, lịch sử đơn và RPC lưu nguyên tử. Xem
[phạm vi, migration bổ sung và hướng dẫn kiểm thử](CRM-ADMIN-PROFILE.md).
Migration hỗ trợ khách hàng đã áp dụng vào Supabase project Phub ngày 23/10/2026;
không đồng nghĩa toàn bộ migration CRM đã được nghiệm thu. Đợt hỗ trợ đã có trang Admin
và API tiếp nhận/xử lý ticket; xem [phạm vi và hướng dẫn](CUSTOMER-SUPPORT.md).
Form gửi phản hồi phía khách hàng và khảo sát chưa triển khai. Các checklist bên dưới là backlog tổng, không phải
xác nhận toàn bộ ticket đã hoàn thành.

## 1. Mục tiêu và giới hạn

Phát triển CRM chăm sóc khách hàng, phản hồi sản phẩm và khảo sát trên hệ thống
bán hàng hiện tại. Không xây lại hệ thống bán hàng, kho hoặc xác thực.

- Giữ ba vai trò `ADMIN`, `NHAN_VIEN_KHO`, `KHACH_HANG` ở giai đoạn đầu.
- `ADMIN` đảm nhiệm quản lý CRM; khách thao tác trên website khách hàng.
- CRM có nhóm màn hình/menu riêng trong ứng dụng hiện có; không bắt buộc thêm
  frontend, website hay tài khoản đăng nhập riêng.
- Xác nhận cách tách giao diện quản trị hệ thống/nghiệp vụ với giảng viên.
- Không đưa HRM, chấm công, tính lương, sales pipeline, email marketing hoặc
  đồng bộ CRM bên ngoài vào phạm vi đầu tiên.

Mức ưu tiên:

- **P0:** nền tảng hoặc yêu cầu trực tiếp của đề CRM.
- **P1:** hoàn thiện luồng chăm sóc sau bán và trải nghiệm.
- **P2:** mở rộng sau khi hoàn thành bản demo.

## 2. Căn cứ và hiện trạng đã kiểm tra

Yêu cầu đồ án được đối chiếu từ tài liệu Word người dùng cung cấp:
`SGU - 2026_2027 - HK1 - DO AN HTTTDN.docx`.

### Những phần tái sử dụng

- [Schema hiện tại](../Backend/schema.dbml): khách hàng, tài khoản, nhân viên,
  sản phẩm, đơn hàng, hóa đơn và thanh toán.
- [API xác thực](../Backend/phub_api/controllers/auth.py): đăng ký/đăng nhập khách.
- [API tài khoản](../Backend/phub_api/controllers/admin_accounts.py): tạo tài khoản,
  sửa username/email, ẩn/khóa/mở khóa và đổi quyền nhân viên.
- [API khách hàng](../Backend/phub_api/controllers/commerce.py): hồ sơ nhận hàng,
  đơn hàng và hóa đơn của khách đang đăng nhập.
- [Generic resource](../Backend/phub_api/models/resources.py): đã có `customers`.
- UI hiện có: `ui/adminUI`, `ui/userUI/Frontend`; kho tiếp tục dùng `ui/warehouseUI`.
- Admin đã có cache, polling và preload; cần tích hợp CRM, không làm lại toàn bộ.

### Khoảng trống

- `KHACH_HANG` mới chứa tên, số điện thoại và địa chỉ mặc định; chưa có ngày sinh,
  sở thích hoặc vòng đời hồ sơ CRM.
- Chưa thấy module CRM chuyên biệt trong schema và các controller đã kiểm tra:
  phản hồi sản phẩm, khảo sát, câu trả lời và báo cáo hài lòng.
- `TAI_KHOAN.email` là nguồn email tài khoản; không tự tạo thêm email CRM gây lệch dữ liệu.
- `TAI_KHOAN.trang_thai` hiện dùng `0 = ẩn`, `1 = hoạt động`, `2 = tạm khóa`.
  Ẩn tài khoản không tự động đồng nghĩa xóa hồ sơ khách hàng.
- Quan hệ tài khoản hiện tại là một khách hàng HOẶC một nhân viên; giữ nguyên
  ràng buộc này, không gắn đồng thời cả hai để làm CRM.

**Giới hạn đánh giá:** đây là hiện trạng từ mã/schema trong repository, chưa phải
kết quả kiểm tra trực tiếp cấu trúc Supabase đang chạy. Phải đối chiếu DB thật trước
khi chốt migration; tài liệu README có thể chưa đồng bộ với mã.

## 3. Checklist đối chiếu tiêu chí đồ án

### P0 — phía người quản lý

- [ ] Thêm khách hàng, tái sử dụng luồng tạo hồ sơ/tài khoản nếu phù hợp.
- [ ] Xóa khách hàng: chốt với giảng viên việc xóa mềm có được chấp nhận không.
- [ ] Khóa/mở khóa tài khoản khách; kiểm tra quyền ở backend.
- [ ] Tiếp nhận và xem phản hồi của khách về sản phẩm.
- [ ] Báo cáo tỷ lệ độ tuổi và sở thích của khách hàng.
- [ ] Tạo bảng khảo sát và gửi đến tài khoản khách hàng.
- [ ] Thống kê kết quả khảo sát.

### P0 — phía khách hàng

- [ ] Kiểm thử lại đăng ký và đăng nhập đang có.
- [ ] Xem/sửa hồ sơ của chính mình, bổ sung ngày sinh và sở thích.
- [ ] Gửi phản hồi về sản phẩm.
- [ ] Nhận, xem và trả lời khảo sát được gửi đến mình.

### Phần chung của đồ án — không được bỏ sót

- [ ] Phân biệt giao diện quản trị tài khoản/phân quyền và giao diện nghiệp vụ.
- [ ] Rà soát yêu cầu thêm/xóa/phân quyền account; hiện API ẩn/khóa chưa chứng minh
  đã đáp ứng tiêu chí xóa account.
- [ ] Báo cáo khảo sát HTTT doanh nghiệp có ít nhất 15 câu hỏi và tổng kết kết quả.
- [ ] Hoàn thiện sơ đồ chức năng, ngữ cảnh, DFD mức đỉnh và ERD/từ điển dữ liệu.
- [ ] Có phương án sao lưu, phục hồi và hướng dẫn sử dụng/cài đặt.
- [ ] Chuẩn bị tài khoản test, dữ liệu mẫu và kịch bản nghiệp vụ.

Lưu ý: khảo sát HTTT dùng cho báo cáo môn học và khảo sát khách hàng chạy trong
module CRM là hai việc khác nhau. Phần báo cáo chiếm 40 điểm, CSDL/Admin 30 điểm,
module lựa chọn 30 điểm.

## 4. Thay đổi database đề xuất

Không cần viết lại DB. Phương án dưới đây là **mở rộng cộng thêm**: bổ sung cột
cho `KHACH_HANG`, giữ nguyên bảng tài khoản/bán hàng và thêm khoảng **9 bảng CRM
cốt lõi**. Đây là thiết kế sơ bộ, không phải số bảng bắt buộc theo đề.

### 4.1. P0 — mở rộng KHACH_HANG

| Cột đề xuất | Kiểu PostgreSQL | Mục đích |
|---|---|---|
| `ngay_sinh` | `date`, nullable | Tính nhóm tuổi tại thời điểm báo cáo |
| `ngay_tao` | `timestamptz` | Theo dõi thời điểm ghi nhận hồ sơ |
| `cap_nhat_luc` | `timestamptz` | Hỗ trợ đồng bộ và phát hiện cập nhật |
| `luu_tru_luc` | `timestamptz`, nullable | Lưu trữ/xóa mềm hồ sơ, nếu được thống nhất |

- [ ] Không lưu cột `tuoi` cố định vì tuổi thay đổi theo thời gian.
- [ ] Hồ sơ cũ để ngày sinh NULL; không tự điền ngày sinh giả.
- [ ] Nếu không biết ngày tạo thật của hồ sơ cũ, để NULL hoặc ghi rõ đó là thời
  điểm migration; không dùng làm căn cứ khẳng định ngày khách đăng ký.
- [ ] Kiểm tra ngày sinh không ở tương lai tại API; không ép khách cũ bổ sung
  thông tin mới trước khi được mua hàng.
- [ ] Cập nhật `cap_nhat_luc` nhất quán ở DB hoặc mọi đường ghi, kể cả generic API.
- [ ] Quy định rõ: lưu trữ hồ sơ có khóa tài khoản hay không, xử lý phiên đang
  đăng nhập thế nào và có cho khôi phục không. Thay đổi liên quan phải nguyên tử.
- [ ] Không xóa dây chuyền đơn hàng, hóa đơn, thanh toán khi lưu trữ khách.

### 4.2. P0 — sở thích: 2 bảng

| Bảng đề xuất | Dữ liệu chính và ràng buộc |
|---|---|
| `SO_THICH` | Mã, tên duy nhất, trạng thái; ví dụ gaming, văn phòng, đồ họa |
| `KHACH_HANG_SO_THICH` | `ma_kh`, `ma_so_thich`; PK ghép, FK tới khách và danh mục sở thích |

Tên hai bảng sở thích đã được người dùng chốt không có tiền tố `CRM_`.
Migration local đã dùng tên mới; nếu đã áp dụng migration/đổi tên trên Supabase,
không chạy lại script tạo bảng. Những tên constraint/index cũ còn lại sau thao tác
đổi tên bảng không có nghĩa là phải xóa và tạo lại dữ liệu.

- [ ] Cho phép một khách chọn nhiều sở thích, không lưu chuỗi phân cách bằng dấu phẩy.
- [ ] Tách sở thích tự khai báo khỏi suy luận từ lịch sử mua hàng.
- [ ] Không bắt buộc đồng nhất sở thích với loại sản phẩm: đây là nhu cầu sử dụng.

### 4.3. P0 — phản hồi: 1 bảng

`PHAN_HOI` (tên đã dùng trong bản hỗ trợ khách hàng) gồm:

Bản Admin hỗ trợ đã có mã tiếp nhận/xử lý, API khách tạo và xem ticket của mình.
Xem [phạm vi, migration và giới hạn](CUSTOMER-SUPPORT.md). Chưa có form gửi ticket
trên website khách, rating hoặc hội thoại nhiều lượt; các mục dưới vẫn là backlog
để đối chiếu, không phải xác nhận đã nghiệm thu Supabase thật.

- PK `ma_phan_hoi`; FK `ma_kh` và `ma_sp` tới khách/sản phẩm.
- `ma_donhang` nullable để liên kết giao dịch khi có; xác minh đơn và sản phẩm
  thực sự thuộc khách nếu gửi kèm mã đơn.
- Tiêu đề, nội dung; điểm hài lòng 1–5 nullable.
- Trạng thái: `MOI`, `DANG_XU_LY`, `DA_GIAI_QUYET`, `DA_DONG`.
- Người xử lý là FK tới `NHAN_VIEN`; giai đoạn đầu chỉ cho phân công ADMIN.
- Ngày tạo/cập nhật; các trường phản hồi công khai của quản lý, người trả lời
  và thời điểm trả lời nếu triển khai phần P1.

- [ ] Thống nhất tham chiếu sản phẩm bằng `ma_sp` trong module mới; không nhầm với
  `sku` mà chi tiết đơn hàng đang sử dụng. Kiểm tra quan hệ qua `SAN_PHAM`.
- [ ] P0 tiếp nhận phản hồi không bắt buộc đã mua hàng; nhãn "đã mua" và liên kết
  đơn chỉ hiển thị khi đã xác minh. Quy tắc khác cần được chốt trước triển khai.
- [ ] Khách không được tự gán người xử lý, đổi trạng thái hoặc giả người gửi.
- [ ] P1 quy định chuyển trạng thái, mở lại yêu cầu và ghi lại lịch sử xử lý.

### 4.4. P0 — khảo sát: 6 bảng

| Bảng đề xuất | Dữ liệu chính |
|---|---|
| `CRM_KHAO_SAT` | Tiêu đề, mô tả, người tạo, thời gian mở/đóng, trạng thái NHAP/MO/DONG |
| `CRM_CAU_HOI` | FK khảo sát, nội dung, loại CHON_MOT/THANG_DIEM/VAN_BAN, bắt buộc, thứ tự |
| `CRM_LUA_CHON` | FK câu hỏi, nội dung lựa chọn, thứ tự |
| `CRM_NGUOI_NHAN_KHAO_SAT` | FK khảo sát và `ma_tk`, thời điểm gửi/đã xem; unique khảo sát–tài khoản |
| `CRM_BAI_TRA_LOI` | FK bản ghi người nhận, thời điểm nộp; unique người nhận cho một lần nộp |
| `CRM_CT_TRA_LOI` | FK bài trả lời/câu hỏi, lựa chọn hoặc điểm hoặc văn bản; unique bài–câu hỏi |

- [ ] Chỉ gửi tới tài khoản liên kết khách hàng, đang hoạt động và không lưu trữ.
- [ ] "Gửi" ở bản đầu là xuất hiện trong mục khảo sát của tài khoản khách;
  không bắt buộc tích hợp email hoặc Zalo.
- [ ] Chốt một lần nộp hoàn chỉnh/khách/khảo sát; chưa làm bản nháp câu trả lời.
- [ ] Chống nộp trùng bằng UNIQUE ở DB, không chỉ vô hiệu hóa nút trên UI.
- [ ] Nộp bài và chi tiết câu trả lời trong cùng transaction/RPC.
- [ ] Ràng buộc câu hỏi thuộc đúng khảo sát, lựa chọn thuộc đúng câu hỏi và bài
  trả lời thuộc đúng người nhận. Dùng khóa ngoại ghép khi phù hợp và kiểm tra API.
- [ ] Kiểm tra câu bắt buộc, kiểu câu trả lời và điểm trong phạm vi 1–5.
- [ ] Khóa sửa cấu trúc câu hỏi/lựa chọn sau khi phát hành; muốn đổi thì nhân bản
  khảo sát. Đóng khảo sát không xóa kết quả.
- [ ] Không dùng cascade từ tài khoản/khách để âm thầm mất dữ liệu khảo sát.

### 4.5. P1/P2 — không bắt buộc cho bản đầu

- [ ] P1 thêm `CRM_TUONG_TAC`: FK khách/phản hồi, người thực hiện, loại sự kiện,
  nội dung, thời điểm và phạm vi `NOI_BO`/`KHACH_XEM_DUOC`.
- [ ] P1 giữ lịch sử thay đổi trạng thái/phân công; ghi cùng transaction nghiệp vụ.
- [ ] P1 xem timeline khách từ đơn hàng + phản hồi + khảo sát + tương tác; không
  sao chép toàn bộ đơn hàng sang bảng CRM mới.
- [ ] P2 nhắc lịch chăm sóc, người phụ trách riêng, phân nhóm nâng cao.
- [ ] P2 tệp đính kèm/media chung: metadata file, chủ sở hữu, bucket/object key,
  quyền đọc và dọn file mồ côi. Không đưa vào migration CRM đầu tiên.

## 5. P0 — migration và các điểm dễ gây lỗi

- [ ] Đối chiếu schema Supabase thực tế, FK, RLS, RPC và phiên bản migration đã chạy.
- [ ] Backup DB trước thay đổi; thử phục hồi backup trên môi trường tách biệt.
- [ ] Dùng migration nâng cấp có phiên bản trong `Backend/migrations/`, theo
  quy ước đang có; không chạy lại `001_initial_schema.sql` trên DB có dữ liệu.
- [ ] Cập nhật `Backend/schema.dbml` theo thiết kế đã duyệt và đồng bộ luồng tạo
  DB trống; không chỉ sửa SQL mà quên DBML hoặc ngược lại.
- [ ] Chạy thử cả hai đường: DB cũ có dữ liệu và DB trống mới dựng.
- [ ] Giữ PK/FK, trạng thái và dữ liệu bán hàng hiện tại; tránh đổi tên bảng/cột cũ.
- [ ] Thêm FK, UNIQUE, CHECK và index phục vụ lọc khách, trạng thái, ngày tạo,
  người nhận khảo sát và báo cáo; đánh giá truy vấn thật trước khi thêm hàng loạt.
- [ ] Bật RLS và chặn truy cập trực tiếp không được phép; giữ secret/service key
  ở backend. Backend vẫn phải kiểm tra quyền vì khóa đặc quyền có thể bỏ qua RLS.
- [ ] Hạn chế quyền EXECUTE của RPC ghi dữ liệu theo mô hình backend hiện tại.
- [ ] Cập nhật metadata PostgREST và thử API sau migration.
- [ ] Có kế hoạch rollback; không mặc định DROP bảng CRM đã có câu trả lời thật.

**Điểm đặc thù cần sửa cùng:** `Backend/phub_api/models/resources.py` đang đọc DBML
bằng regex chỉ nhận `int`, `varchar`, `text`, `datetime`, `decimal`. Nếu thêm `date`,
`timestamptz`, `boolean`, `uuid` hoặc kiểu khác, phải cập nhật parser và các lớp
schema/form liên quan, hoặc dùng DTO CRM chuyên biệt thay vì nhét vào generic CRUD.
Không khai báo sai kiểu DBML để lách parser. Trường hệ thống như ngày tạo/lưu trữ
không được thành ô cho khách tự sửa khi metadata thay đổi.

## 6. Backend — cấu trúc và hợp đồng API dự kiến

Giữ cấu trúc `Backend/phub_api/{controllers,services,repositories,schemas,dependencies}`.
**Không tạo lại package `Backend/app`.** Các đường dẫn dưới đây là đề xuất, chưa có
nghĩa endpoint đã tồn tại.

### P0 — công việc

- [ ] Tách nghiệp vụ CRM vào các lớp trên; đăng ký router ở `phub_api/main.py`.
- [ ] Dùng session hiện có, không tạo luồng đăng nhập riêng cho CRM.
- [ ] API quản lý chỉ nhận ADMIN; NHAN_VIEN_KHO không có quyền CRM.
- [ ] API khách lấy `ma_kh`/`ma_tk` từ phiên, không tin mã chủ sở hữu từ body/query.
- [ ] Khách chỉ xem phản hồi, khảo sát và dữ liệu của mình; không lộ ghi chú nội bộ.
- [ ] API danh sách có phân trang, lọc, sắp xếp được kiểm soát và giới hạn đầu vào.
- [ ] Không mở các bảng khảo sát qua generic CRUD nếu việc đó bỏ qua kiểm tra
  ownership, trạng thái phát hành hoặc transaction.
- [ ] Không làm thay đổi bất tương thích API nhận hàng `/api/customer/me` đang có;
  có thể thêm endpoint hồ sơ CRM chuyên biệt.
- [ ] Chuẩn hóa lỗi 401/403/404/409/422/503; không trả SQL hoặc secret cho UI.
- [ ] Cập nhật Swagger, `Backend/docs/openapi.json` và tài liệu API.

### Nhóm endpoint dự kiến

| Nhóm | Endpoint đề xuất |
|---|---|
| Hồ sơ quản lý | `GET/POST /api/crm/customers`, `GET/PATCH /api/crm/customers/{id}` |
| Lưu trữ/khôi phục | `POST /api/crm/customers/{id}/archive`, `/restore` sau khi chốt quy tắc |
| Hồ sơ tự phục vụ | `GET/PATCH /api/customer/crm/profile` |
| Sở thích | `GET /api/customer/crm/interests`; cập nhật danh sách qua hồ sơ |
| Phản hồi khách | `GET/POST /api/customer/crm/feedback`, `GET .../feedback/{id}` |
| Phản hồi quản lý | `GET /api/crm/feedback`, `GET/PATCH .../feedback/{id}` |
| Soạn/phát hành khảo sát | `GET/POST /api/crm/surveys`, `GET/PATCH .../surveys/{id}`, `POST .../{id}/publish`, `POST .../{id}/close` |
| Gửi khảo sát | `POST /api/crm/surveys/{id}/recipients` |
| Khảo sát khách | `GET /api/customer/crm/surveys`, `GET .../surveys/{id}`, `POST .../{id}/responses` |
| Báo cáo | `GET /api/crm/reports/customers`, `GET /api/crm/surveys/{id}/results` |

Tái sử dụng API khóa/mở khóa `/api/admin/accounts/{account_id}/status` khi phù hợp;
không tạo hai nguồn trạng thái độc lập. Nếu giao diện dùng mã khách, phải tra đúng
tài khoản liên kết trước khi gọi API tài khoản.

## 7. Giao diện quản lý và khách hàng

### P0 — Admin/CRM

- [ ] Thêm menu CRM: Khách hàng, Phản hồi, Khảo sát, Báo cáo.
- [ ] Tái sử dụng trang khách hàng hiện tại, tránh hai màn hình sửa cùng hồ sơ
  nhưng dùng logic/kiểm tra khác nhau.
- [ ] Chi tiết khách tổng hợp hồ sơ, tài khoản và lịch sử mua; tải theo tab/phân trang.
- [ ] Form hồ sơ có ngày sinh, nhiều sở thích, trạng thái lưu trữ.
- [ ] Danh sách/chi tiết phản hồi: sản phẩm, khách, nội dung, thời gian, trạng thái.
- [ ] Soạn khảo sát, thêm câu hỏi/lựa chọn, xem trước, chọn người nhận, phát hành/đóng.
- [ ] Xem số người được gửi, đã trả lời và thống kê từng câu hỏi.
- [ ] Có loading cục bộ, empty/error state; thao tác thành công chỉ cập nhật phần
  liên quan, không tải lại toàn bộ trang.

### P0 — website khách hàng

- [ ] Bổ sung ngày sinh/sở thích vào hồ sơ.
- [ ] Form phản hồi sản phẩm và danh sách phản hồi của chính mình.
- [ ] Mục "Khảo sát dành cho bạn": chưa trả lời/đã trả lời/hết hạn.
- [ ] Trang trả lời khảo sát, báo lỗi câu bắt buộc và xác nhận nộp thành công.
- [ ] P1 cho khách xem phản hồi xử lý từ quản lý.
- [ ] Kiểm tra mobile, bàn phím, nhãn form và thông báo lỗi tiếng Việt.

Đọc `ui/userUI/Frontend/AGENTS.md` trước khi sửa frontend khách; tài liệu kế hoạch
này không thay thế các hướng dẫn áp dụng trong từng thư mục.

## 8. Báo cáo — tránh thống kê sai

- [ ] Nhóm tuổi tính từ ngày sinh theo ngày báo cáo; có nhóm "Chưa cung cấp".
- [ ] Công bố mẫu số tỷ lệ: toàn bộ khách đang hoạt động hay nhóm đã cung cấp dữ
  liệu; không tự bỏ khách thiếu thông tin mà không chú thích.
- [ ] Sở thích cho phép chọn nhiều: tổng tỷ lệ các sở thích có thể lớn hơn 100%.
- [ ] Tỷ lệ hoàn thành khảo sát = số người nộp hợp lệ / số tài khoản được gửi hợp lệ.
  Hiển thị quy tắc xử lý người nhận bị khóa/lưu trữ sau khi gửi; không âm thầm đổi mẫu số.
- [ ] Câu hỏi tùy chọn dùng số người thực sự trả lời câu đó làm mẫu số.
- [ ] Điểm hài lòng chỉ tính trên phản hồi/câu trả lời có điểm; không coi NULL là 0.
- [ ] Lọc theo khoảng thời gian, dùng timestamp có múi giờ; tuổi dùng kiểu date.
- [ ] Tính tổng hợp ở backend/DB, không chỉ cộng dữ liệu của trang đầu đang hiển thị.
- [ ] P1 báo cáo phản hồi theo trạng thái, thời gian xử lý và sản phẩm.

## 9. Cache, đồng bộ và bảo vệ dữ liệu

- [ ] Tích hợp với `ui/adminUI/src/lib/admin-fetch.ts`, `use-admin-polling.ts` và
  `admin-preload.ts`, kiểm tra lại khả năng áp dụng cho endpoint CRM.
- [ ] Sau mutation, cập nhật/invalidate các cache liên quan: hồ sơ, danh sách,
  phản hồi, khảo sát và báo cáo; không đợi hết TTL mới thấy thay đổi của mình.
- [ ] Nếu tiếp tục polling 10 giây, chỉ poll dữ liệu đang xem khi tab hiển thị;
  chống request chồng nhau và không làm mất nội dung form đang nhập.
- [ ] Không gọi polling là realtime: vẫn có độ trễ theo chu kỳ và thời gian xử lý.
- [ ] Cache không hết hạn chỉ an toàn khi có revalidation/invalidation đáng tin;
  hỏng đồng bộ phải hiển thị thời điểm cập nhật và nút tải lại, không cam kết luôn mới.
- [ ] Không lấy `max(cap_nhat_luc)` làm cơ chế phát hiện mọi thay đổi: có thể bỏ
  sót xóa hoặc thay đổi bảng con. Chọn refetch phạm vi nhỏ hoặc version tổng hợp
  được tăng nguyên tử theo mutation trước khi tối ưu.
- [ ] Cache tách theo phiên/tài khoản; đăng xuất hoặc đổi quyền phải xóa dữ liệu cũ.
- [ ] Không preload toàn bộ lịch sử khách, toàn bộ khảo sát hoặc dữ liệu riêng tư
  sang mọi màn hình. Giữ preload có giới hạn và ưu tiên request đang thao tác.
- [ ] P2 mới cân nhắc Supabase Realtime/SSE; không chặn P0 vì tính năng này.

## 10. Kiểm thử và nghiệm thu

### Database và API

- [ ] Migration DB có dữ liệu không làm mất khách, đơn, hóa đơn hoặc tài khoản.
- [ ] UNIQUE/FK/CHECK, dữ liệu NULL cũ, rollback và phục hồi backup được kiểm thử.
- [ ] ADMIN truy cập được CRM; NHAN_VIEN_KHO bị từ chối; khách không xem dữ liệu người khác.
- [ ] Khóa tài khoản chặn truy cập API theo cơ chế phiên backend, không chỉ ẩn menu.
- [ ] Không giả chủ sở hữu, người tạo, người xử lý hoặc gửi khảo sát cho tài khoản kho.
- [ ] Không trả lời khảo sát chưa được gửi, chưa mở, đã đóng hoặc nộp lần hai.
- [ ] Nộp đồng thời và gửi lại do lỗi mạng không tạo hai bài trả lời.
- [ ] Câu trả lời không thể tham chiếu câu hỏi/lựa chọn của khảo sát khác.
- [ ] Báo cáo đúng với dữ liệu nhiều trang, khách thiếu ngày sinh, nhiều sở thích
  và người nhận thay đổi trạng thái sau phát hành.
- [ ] Chạy regression đăng ký, đăng nhập, tạo tài khoản, checkout, đơn hàng và kho.
- [ ] Tests mock và OpenAPI snapshot không thay thế kiểm thử migration/PostgREST thật.

### UI và kịch bản demo

- [ ] Dựng dữ liệu demo riêng: nhiều nhóm tuổi, ít nhất ba sở thích, tài khoản bị
  khóa, khách thiếu thông tin, phản hồi nhiều trạng thái và khảo sát đã/chưa trả lời.
- [ ] Quản lý tạo khảo sát sản phẩm mới, chọn khách nhận và phát hành.
- [ ] Khách đăng nhập, bổ sung hồ sơ, gửi phản hồi sản phẩm và nộp khảo sát.
- [ ] Quản lý thấy phản hồi, xử lý yêu cầu và xem kết quả khảo sát/báo cáo.
- [ ] P1 khách xem kết quả xử lý, timeline thể hiện toàn bộ quá trình.
- [ ] Chuyển trang dùng cache nhanh nhưng dữ liệu thay đổi vẫn được cập nhật;
  lỗi mạng có thông báo và retry, không báo thành công giả.

## 11. Thứ tự thực hiện đề xuất

| Đợt | Việc chính | Điều kiện hoàn thành |
|---|---|---|
| 1 | Chốt phạm vi, quy tắc xóa/khóa, ERD và hợp đồng API | Duyệt thiết kế; đối chiếu DB thật |
| 2 | Migration hồ sơ/sở thích và API/UI tương ứng | Khách cũ vẫn dùng được; hồ sơ mới lưu đúng |
| 3 | Phản hồi sản phẩm và màn hình tiếp nhận | Khách gửi, Admin xem; phân quyền đúng |
| 4 | Khảo sát, gửi, trả lời và thống kê | Luồng đầu-cuối chạy, chống nộp trùng |
| 5 | Báo cáo tuổi/sở thích, cache và regression | Số liệu có mẫu số rõ; không phá bán hàng/kho |
| 6 | Hoàn thiện P1, báo cáo môn học và demo | Có tài liệu, backup/restore và kịch bản test |

Nếu thời gian hạn chế, hoàn thành toàn bộ P0 trước; không làm sales pipeline,
email marketing hoặc vai trò CRM mới trước phản hồi/khảo sát/báo cáo bắt buộc.

## 12. Những quyết định phải chốt trước khi viết mã

- [ ] Giảng viên chấp nhận xóa mềm khách/account hay yêu cầu thao tác khác?
- [ ] Khu vực CRM chung frontend nhưng tách menu/quyền có đáp ứng yêu cầu giao diện?
- [ ] Chốt danh mục sở thích, nhóm tuổi và các loại câu hỏi bản đầu.
- [ ] Chốt dữ liệu phản hồi công khai với khách và dữ liệu ghi chú nội bộ.
- [ ] Chốt người nhận khảo sát theo tài khoản tại thời điểm gửi và cách xử lý tài
  khoản bị khóa/lưu trữ sau đó.
- [ ] Chọn DB thử nghiệm và người được phép chạy migration; không tự áp dụng trên
  Supabase production chỉ vì đã có file SQL.

**Kết luận:** phần cần mở rộng lớn nhất là dữ liệu và quy trình tương tác/khảo sát,
không phải thay toàn bộ cấu trúc hiện tại. Làm từng migration và từng luồng hoàn
chỉnh sẽ dễ kiểm soát hơn thêm hàng loạt bảng rồi mới nối giao diện.

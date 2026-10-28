# Hỗ trợ khách hàng — tiếp nhận ticket

## Giao diện Admin

- URL: `/support`, nằm trong **Tiếp thị → Hỗ trợ khách hàng**.
- Không lặp lại tiêu đề/mô tả trang dưới breadcrumb; nút Làm mới nằm cùng bộ lọc.
- Hộp thư có tổng kết quả theo bộ lọc, tìm theo mã thẻ/tiêu đề/nội dung, lọc trạng thái,
  ưu tiên và phân trang 20 ticket/lần; không thay thế dữ liệu thật bằng ticket mẫu.
- Mã thẻ dạng `PH-XXXXXXXX` không phân biệt hoa/thường; có thể nhập riêng phần đầu
  sau dấu `-` (1–8 ký tự hex, ví dụ `CB9A`), có hoặc không có `PH-`, hoặc UUID đầy đủ.
  Tìm trên backend trước khi phân trang, giữ bộ lọc trạng thái/ưu tiên; mã rút gọn có
  thể trùng nên trả tất cả ticket khớp. Không ép cột UUID sang kiểu text/ILIKE.
  Cần deploy backend mới để API trên Render hỗ trợ tìm mã; không cần migration DB.
- Chọn một ticket để xem khách gửi, nội dung, sản phẩm/đơn liên quan nếu có.
- Nhận xử lý gán cho ADMIN đang đăng nhập; có thể cập nhật trạng thái, ưu tiên
  và một phản hồi hiện tại cho khách. Lưu không reload document.
- Khi lưu lỗi giữ draft để retry. Đổi ticket khi có thay đổi chưa lưu phải xác nhận.
- Polling 10 giây khi tab hiển thị, không nhập/chỉnh sửa/lưu; đây không phải realtime.
- Trạng thái: `MOI`, `DANG_XU_LY`, `DA_GIAI_QUYET`, `DA_DONG`.
- Ưu tiên nội bộ: `THAP`, `BINH_THUONG`, `CAO`, `KHAN_CAP`.
- Phản hồi quản lý là nội dung công khai với chủ ticket qua API, không phải ghi chú nội bộ.

## Điều kiện dùng dữ liệu thật

1. Backup và thử DB test.
2. Chạy [migration hỗ trợ khách hàng](../Backend/migrations/20261023_customer_support.sql)
   bằng role `postgres` trong Supabase SQL Editor, một lần. Migration thêm bảng
   `PHAN_HOI`, index, RLS và hai RPC; không tạo lại các bảng khách/đơn/tài khoản.
   Không phụ thuộc việc chạy lại migration CRM hồ sơ/sở thích đợt 1.
3. Deploy/restart backend mới và cập nhật frontend. Nếu Admin trỏ Render thì backend
   Render cũng phải có mã mới; chạy SQL không tự cập nhật code Render.
4. Gửi ticket bằng API khách rồi kiểm tra trong Admin. Chưa có form gửi ticket mới
   trên website khách, chưa tự nối trang liên hệ cũ vào module này.

Ngày 23/10/2026 đã áp dụng migration `customer_support`, phiên bản
`20261023012058`, vào project **Phub** (`btfhahnjydaiivvcqnna`) qua Supabase MCP.
Đã xác nhận bảng `PHAN_HOI`, hai RPC, 4 khóa ngoại, 6 index (gồm khóa chính), RLS
và quyền service role đọc/thêm/sửa nhưng không xóa. Không thêm ticket mẫu hoặc sửa
dữ liệu cũ; không áp dụng vào project Phub1. **Không chạy lại migration trên Phub.**
Bản SQL đã qua kiểm thử PostgreSQL nhúng/PGlite biệt lập. Kiểm tra cấu trúc/quyền
trên database thật không thay thế nghiệm thu luồng gửi/xử lý ticket bằng tài khoản thật.
Truy vấn SQL đọc đầy đủ các cột/quan hệ của hộp thư đã thành công, trả danh sách rỗng.
Chưa smoke test qua HTTP Data API/backend bằng phiên người dùng: backend local không
có cấu hình Supabase; Admin local vẫn trỏ API Render. Không tạo ticket giả để kiểm thử.

Advisor sau triển khai chỉ ghi nhận mức INFO cho bảng mới: RLS chưa có policy là
chủ ý vì chặn `anon`/`authenticated` và chỉ backend service role truy cập; index chưa
được dùng vì bảng vừa tạo, chưa có ticket. Không mở policy công khai để bỏ thông báo.
Xem [RLS không có policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
và [index chưa sử dụng](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Dữ liệu demo theo yêu cầu

Sau bước tạo bảng, ngày 23/10/2026 người dùng yêu cầu thêm dữ liệu mẫu. Đã thêm
6 ticket tiếng Việt vào Phub, đánh dấu `[DEMO-PHUB]` ở tiêu đề và ghi rõ demo trong
nội dung; chỉ gắn 6 khách `SEED_` và Admin mẫu, không gắn khách/đơn hàng thật.
Gồm 2 mới, 2 đang xử lý, 1 đã giải quyết, 1 đã đóng; đủ 4 mức ưu tiên.
Script [customer_support_demo.sql](../Backend/seeds/customer_support_demo.sql)
chỉ dùng khi được yêu cầu, không tự chạy trong deploy; chạy lại bỏ qua ticket
trùng tiêu đề và khách mẫu. Đây không phải kết quả nghiệm thu luồng gửi ticket thật.

## API

Browser dùng tiền tố `/api/backend/` qua gateway Next.js; các URL dưới là backend.

| Vai trò | API | Mục đích |
|---|---|---|
| ADMIN | `GET /api/crm/feedback` | Hộp thư; `page`, `page_size`, `status`, `priority`, `q` |
| ADMIN | `GET /api/crm/feedback/{uuid}` | Chi tiết ticket |
| ADMIN | `PATCH /api/crm/feedback/{uuid}` | Nhận xử lý, cập nhật trạng thái/ưu tiên/phản hồi |
| KHACH_HANG | `POST /api/customer/crm/feedback` | Gửi ticket mới |
| KHACH_HANG | `GET /api/customer/crm/feedback` | Danh sách ticket của mình |
| KHACH_HANG | `GET /api/customer/crm/feedback/{uuid}` | Xem ticket/phản hồi thuộc mình |

Ví dụ body khách gửi sau khi đăng nhập bằng phiên Phub:

```json
{
  "tieu_de": "Cần hỗ trợ kiểm tra đơn hàng",
  "noi_dung": "Tôi muốn được tư vấn tình trạng đơn hàng."
}
```

`ma_sp` và `ma_donhang` là tùy chọn. Không gửi `ma_kh`, trạng thái, ưu tiên hoặc
người xử lý; backend/RPC lấy người gửi từ phiên. Nếu gửi mã đơn, đơn phải thuộc
khách; nếu gửi cả sản phẩm và đơn thì sản phẩm phải có trong đơn.

Ví dụ body quản lý:

```json
{
  "nhan_xu_ly": true,
  "trang_thai": "DANG_XU_LY",
  "muc_do_uu_tien": "CAO",
  "phan_hoi_quan_ly": "Chúng tôi đã tiếp nhận và đang kiểm tra."
}
```

`phan_hoi_quan_ly: null` xóa phản hồi hiện tại. Khách xem kết quả qua GET ticket;
không có email/push notification hoặc lịch sử hội thoại nhiều lượt trong bản đầu.
Ưu tiên, phân công và danh tính khách khác không xuất hiện trong response phía khách.

## Quyền và bảo toàn dữ liệu

- THU_KHO không có quyền; khách không đọc được ticket của người khác, kể cả biết UUID.
- API kiểm tra role/ownership; RPC kiểm tra lại tài khoản/role hoạt động khi ghi.
- Không giả lập ADMIN bằng query/body hoặc dùng `auth.uid()` của Supabase Auth.
- Bảng bật RLS, chặn `anon`/`authenticated`; chỉ backend với service key được truy cập.
- RPC không nhận sửa tác giả/nội dung gốc hoặc gán nhân viên tùy ý.
- Foreign key dùng RESTRICT; không xóa dây chuyền khách/sản phẩm/đơn hàng.
- Không mở bảng PHAN_HOI qua generic CRUD; cache Admin tách phiên, mutation invalidation.
- Mỗi cập nhật trạng thái/ưu tiên/nhận xử lý/phản hồi cùng một SQL statement trong RPC.

## Kiểm thử và giới hạn

- `Backend/tests/test_support.py`: API, role, ownership, validation, CSRF, lỗi RPC.
- `Backend/tests/support-sql.test.cjs`: DB RAM, ràng buộc, quyền, nhận xử lý,
  phản hồi, rollback, tài khoản bị khóa. Dùng tooling `@electric-sql/pglite`
  hoặc biến `PHUB_PGLITE_MODULE`; không kết nối Supabase thật.
- `ui/adminUI/tests/support.e2e.cjs`: menu Tiếp thị, inbox/detail, claim, lưu,
  draft khi lỗi, bộ lọc/empty state, desktop/mobile. Toàn bộ API được mock.
- Gateway/cache đã có test đường dẫn hỗ trợ và invalidation liên quan.
- Chưa có hội thoại nhiều lượt, tệp đính kèm, rating 1–5, thông báo chủ động,
  SLA, phân công ADMIN khác hoặc lịch sử audit đầy đủ. Đây là phạm vi tiếp theo,
  không được coi bản đầu đã hoàn thành toàn bộ kế hoạch CRM/phản hồi.

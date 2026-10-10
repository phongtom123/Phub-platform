# API quản lý tài khoản ADMIN

Nguồn dữ liệu: `TAI_KHOAN`, `NHAN_VIEN`, `KHACH_HANG`, `KHO` theo
[DBML](../../../database/schema.dbml). `router.py` định nghĩa HTTP,
`schemas.py` validate payload/response; `service.py` xử lý quy tắc và PostgREST.
Không có tài khoản demo, migration hoặc seed tự chạy.

## Endpoint

Tất cả cần phiên ADMIN qua cookie `phub_session`. Request ghi cần `Origin`
trong `FRONTEND_ORIGINS`. Response đọc không có hash, CCCD, lương hoặc địa chỉ khách.

| Method | URL | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/accounts` | Tìm kiếm, lọc role/status, phân trang |
| POST | `/api/admin/accounts` | Tạo người mới và tài khoản cùng lúc; vẫn hỗ trợ payload cấp cho người có sẵn |
| GET | `/api/admin/account-owners` | Tra cứu nhân viên/khách, đánh dấu đã có tài khoản |
| GET | `/api/admin/accounts/{id}` | Chi tiết |
| PATCH | `/api/admin/accounts/{id}` | Sửa tên đăng nhập/email |
| POST | `/api/admin/accounts/{id}/status` | `{ "trang_thai": 0/1/2 }` |
| PUT | `/api/admin/accounts/{id}/role` | `{ "role": "ADMIN"/"THU_KHO", "ma_kho": null/số }` |
| POST | `/api/admin/accounts/{id}/password` | Cấp lại mật khẩu tài khoản khác |
| GET | `/api/admin/me` | Tài khoản đang đăng nhập |
| PATCH | `/api/admin/me` | Sửa tên/email của mình |
| POST | `/api/admin/me/password` | Mật khẩu hiện tại và mật khẩu mới |

Query danh sách: `q` tìm literal mã/tên đăng nhập/email; `role` = ADMIN,
THU_KHO hoặc KHACH_HANG; `status` = 0/1/2; `page` từ 1, `page_size` 1–100.
Response `{data,total,page,page_size}`. Chi tiết/ghi trả một `AccountRead`.
Tra cứu chủ tài khoản: `kind=employees|customers`, `q`, `page`, `page_size`.
Endpoint tra cứu giữ để tương thích; form tạo tài khoản mới không dùng chọn hồ sơ.

Form mới gửi payload sau (ví dụ minh họa, không phải thông tin đăng nhập thật):

```json
{
  "ten_tai_khoan": "employee.new",
  "email": "employee@example.test",
  "new_owner": { "ho_ten": "Người dùng mới", "role": "ADMIN", "ma_kho": null },
  "password": "replace-with-real-password"
}
```

## Quy tắc

- Form tạo mới không gửi `ma_tk`. Database tự cấp mã theo loại tài khoản: ADMIN →
  `AD000001`, THU_KHO → `KHO000001`, KHACH_HANG → `KH000001`. Mỗi loại có sequence
  riêng; phần số tối thiểu 6 chữ số, không bị cắt khi vượt 999999. Mã cũ giữ nguyên;
  mã đã tồn tại được bỏ qua. Số có thể nhảy khi giao dịch thất bại, không bảo đảm liên tục.
- Đúng một `ma_nhan_vien` hoặc `ma_kh`, mỗi hồ sơ tối đa một tài khoản.
  Payload `new_owner` tạo người mới; mã nhân viên/khách do backend sinh bằng UUID.
  Payload cũ `ma_nhan_vien`/`ma_kh` chỉ cấp cho người có sẵn. Không trộn hai loại payload.
  PK/chủ sở hữu không sửa được sau khi tạo.
- ADMIN chọn loại tài khoản mới: ADMIN, THU_KHO hoặc KHACH_HANG. Họ tên bắt buộc,
  tối đa 200 ký tự. Vai trò vẫn lưu trên NHAN_VIEN; khách không được nâng thành admin.
- ADMIN không gán kho; THU_KHO phải gán một kho đang hoạt động. Cập nhật quyền/kho
  cùng một dòng nhân viên; phiên đọc lại role ở request tiếp theo.
- Username 3–80 ký tự ASCII chữ/số/._-, phân biệt hoa/thường. Không có `@`.
  Email tùy chọn, chuẩn hóa chữ thường. Chỉ payload cũ cấp tài khoản cho người có sẵn
  nhận mã thủ công: 1–100 ký tự chữ/số/._-, khác `.`/`..`/`new`.
- Mật khẩu 10–128 ký tự, giữ nguyên khoảng trắng, hash Argon2. Không nhận hash
  từ UI, không trả mật khẩu/hash; validation không echo payload bí mật.
- Trạng thái 0 = ẩn và không đăng nhập; 1 = hoạt động; 2 = tạm khóa. Không DELETE.
  Chặn tự khóa/ẩn/hạ quyền, kể cả qua API nhân viên generic.
- Cấp lại mật khẩu tài khoản khác không cần mật khẩu cũ (quyền ADMIN).
  Tự đổi phải xác nhận mật khẩu hiện tại, compare-and-swap hash chống ghi đè
  hai lần đổi đồng thời; thành công xóa cookie và yêu cầu đăng nhập lại.
- Hash mới vô hiệu mọi token cũ. Khóa/ẩn chặn truy cập, nhưng mở lại có thể khôi
  phục token còn hạn: chưa có blacklist phiên. Không có bảo vệ “admin cuối cùng”
  bằng transaction hay audit log; nếu cần phải bổ sung schema/RPC riêng.
- Login và tự đổi mật khẩu chung limiter 20 lần/IP/phút trong một process.
  Nhiều worker cần shared limiter. Chưa có quên mật khẩu email/MFA/refresh token.
- Account POST/PATCH generic bị chặn. Tạo mới người + tài khoản dùng một RPC transaction;
  unique/FK/check constraints bảo vệ dữ liệu và rollback cả hai bản ghi khi có lỗi.

## Migration bắt buộc cho form tạo mới

Chạy thủ công [20261010_admin_account_creation.sql](../../migrations/20261010_admin_account_creation.sql)
trong SQL Editor của database tương ứng trước khi thử lưu tài khoản mới. Script chỉ
thêm schema/sequence riêng và hàm RPC, thay overload cũ nhận mã thủ công; không
xóa/sửa dữ liệu hay mã tài khoản cũ, không thay cấu trúc bảng; không tự chạy khi app start.
Hàm chỉ cho `service_role` gọi, kiểm tra lại phiên ADMIN và kho hoạt động ngay trong transaction.
Nếu chưa cài hàm, API trả 503 kèm hướng dẫn migration, không fallback tạo hai dòng bằng HTTP.
Mật khẩu chỉ được hash Argon2 trên Python; không trả hash trong response.

Test SQL dùng PostgreSQL WASM cách ly, không cần Supabase và không ghi lên cloud:

```powershell
# Cài @electric-sql/pglite ở thư mục công cụ riêng, đặt PHUB_PGLITE_MODULE
# thành file URL trỏ đến dist/index.js của package đó.
node Backend/scripts/check_admin_account_creation.mjs
```

Lỗi: 401 chưa đăng nhập/phiên vô hiệu; 403 sai role/origin; 404 không có tài khoản;
409 dữ liệu trùng/tự khóa/tự hạ quyền/xung đột; 422 payload/FK/sai mật khẩu hiện tại;
429 thử quá nhiều; 503 thiếu cấu hình/kết nối DB. Không trả chi tiết SQL.

## Kiểm thử và triển khai

Từ root: `Backend/.venv/Scripts/python.exe -m pytest Backend/tests -q`.
`test_admin_accounts.py` dùng HTTP mock cùng PostgREST query builder thật, không
cần khóa và không ghi vào Supabase. Bao gồm auth thật với JWT/cookie, đổi mật khẩu,
khóa/mở lại, role và chặn bypass qua generic API.

UI gọi `/api/backend/admin/*` cùng origin → gateway Next.js → FastAPI → Supabase.
Admin UI chỉ cần `PHUB_API_BASE_URL`; Supabase secret/JWT secret chỉ nằm ở backend.
Render backend cần FRONTEND_ORIGINS chứa URL admin và COOKIE_SECURE=true.
Push/merge/deploy cả backend và admin UI trước khi dùng trên cloud. Mở
`/openapi.json` và `/docs` sau deploy để thấy nhóm Admin · Tài khoản.

Chưa kiểm thử ghi live Supabase trong đợt này; không nhập khóa vào Swagger/UI.

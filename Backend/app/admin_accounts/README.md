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
| POST | `/api/admin/accounts` | Cấp tài khoản cho một hồ sơ có sẵn |
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
Chỉ chọn nhân viên có trạng thái hoạt động; các hồ sơ đã có tài khoản vẫn hiển thị
để giải thích vì sao không thể cấp thêm.

Ví dụ giả, thay bằng mã hồ sơ thật trước khi Execute:

```json
{
  "ma_tk": "TK_NEW",
  "ten_tai_khoan": "employee.new",
  "email": "employee@example.test",
  "ma_nhan_vien": "NV_EXISTING",
  "ma_kh": null,
  "password": "replace-with-real-password"
}
```

## Quy tắc

- Đúng một `ma_nhan_vien` hoặc `ma_kh`, mỗi hồ sơ tối đa một tài khoản.
  Không tạo/chuyển hồ sơ trong request tài khoản. PK/chủ sở hữu không sửa được.
- Vai trò lấy từ NHAN_VIEN, không nhận role tùy ý lúc tạo. Khách không nâng thành
  admin; muốn cấp quyền nhân sự phải tạo hồ sơ nhân viên riêng.
- ADMIN không gán kho; THU_KHO phải gán một kho đang hoạt động. Cập nhật quyền/kho
  cùng một dòng nhân viên; phiên đọc lại role ở request tiếp theo.
- Username 3–80 ký tự ASCII chữ/số/._-, phân biệt hoa/thường. Không có `@`.
  Email tùy chọn, chuẩn hóa chữ thường. Mã 1–100 ký tự chữ/số/._-, khác `.`/`..`/`new`.
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
- Account POST/PATCH generic bị chặn. Mọi thao tác ghi chỉ thay một dòng DB,
  unique/FK/check constraints bảo vệ dữ liệu; không giả transaction nhiều HTTP.

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

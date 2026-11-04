# Chuyển sang mật khẩu dạng chữ

Thay đổi theo yêu cầu của dự án, ngày 24/10/2026. Mật khẩu lưu nguyên văn trong
`public.TAI_KHOAN.mat_khau`, không còn dùng Argon2/bcrypt hay `mat_khau_hash`
trong backend của bản mã này sau khi triển khai. Cách lưu này làm lộ mật khẩu nếu database/backup bị lộ;
không dùng mật khẩu cá nhân hoặc mật khẩu dùng lại từ dịch vụ khác.

## Phạm vi

- Đăng nhập cookie/Bearer, đăng ký khách, admin tạo người mới hoặc cấp tài khoản
  cho người có sẵn, tự đổi/cấp lại mật khẩu đều dùng cùng cột `mat_khau`.
- API vẫn nhận tên trường `password` / `current_password`; frontend không cần
  đổi payload, ba giao diện tiếp tục gọi API hiện có.
- API đọc, metadata, Swagger examples và JWT không chứa mật khẩu.
- Vai trò, Origin, cookie, giới hạn đăng nhập và phân kho không bị gỡ.
- Thay mật khẩu vô hiệu phiên cũ. Dấu phiên dùng HMAC với JWT secret, không phải
  hash lưu trong database và không phải cơ chế lưu mật khẩu.
- Cột `phien_ban_mat_khau` là mã phiên bản nội bộ, tự thay khi cập nhật mật khẩu
  (kể cả đặt lại cùng giá trị). Nó không phải mật khẩu/hash và không trả qua API.
- RPC mới: `admin_create_account_v2`, `customer_register_v2`,
  `set_account_password_v2`. Chỉ service_role được gọi.
- SQL migration cũ và các kiểm thử lịch sử vẫn mô tả schema/hash ở thời điểm cũ;
  không chỉnh sửa lịch sử đã áp dụng.

## Database đang có tài khoản

Hash không thể đổi ngược thành mật khẩu. Công cụ chuẩn bị offline đối chiếu
những mật khẩu đã biết với hash hiện tại: tài khoản khớp sẽ giữ nguyên mật khẩu;
**chỉ tài khoản không có mật khẩu đã biết** được đặt lại thành chuỗi ngẫu nhiên
riêng biệt `Reset-...`. Không đặt mật khẩu chung/hardcode. ID, người liên kết,
trạng thái và lịch sử nghiệp vụ được giữ; tài khoản đang khóa vẫn khóa.

Không ghi mật khẩu thật vào migration có version control. Dữ liệu đã biết,
snapshot tài khoản/RPC cũ và SQL chuyển đổi sinh ra phải lưu ngoài Git, ví dụ
thư mục `.password-migration-local/` đã được ignore. Không gửi các file đó qua chat.
File `TAI_KHOAN_TEST.local.txt` vẫn dùng được sau chuyển đổi nếu cả ba tài khoản
test được đưa vào danh sách giữ lại và xác minh thành công.

Migration: `Backend/migrations/20261024161801_account_plaintext_passwords.sql`.
Không chạy riêng migration này khi backend Render cũ vẫn đang phục vụ.

### Triển khai có phối hợp

1. Sao lưu `TAI_KHOAN`, định nghĩa RPC v1 và code backend trước khi thay đổi;
   lưu backup ngoài Git. Thử migration trên database biệt lập trước.
2. Chuẩn bị deploy backend mới; tạm dừng truy cập trong cửa sổ chuyển đổi.
   Việc push/merge/deploy Render là bước riêng, không tự xảy ra khi sửa local.
   Commit chuẩn bị dùng `[skip render]` để tránh tự deploy khi database chưa đổi.
   Không coi push lên `feat` là đã cập nhật API; cần phối hợp Manual Deploy của
   đúng commit trong đợt bảo trì, không để việc merge tự kích hoạt chuyển đổi sớm.
3. Chuẩn bị artifact cục bộ (không gọi database):

   ```powershell
   # Từ Backend; thư viện này chỉ phục vụ xác minh hash cũ khi chuẩn bị chuyển đổi.
   .venv\Scripts\python.exe -m pip install -r requirements-migration.txt
   .venv\Scripts\python.exe scripts/prepare_plaintext_password_migration.py --backup ../.password-migration-local/accounts-backup-20261024.json --known-passwords ../.password-migration-local/known-passwords-20261024.json --output ../.password-migration-local/cloud-cutover-20261024.sql
   ```

   Backup JSON có `accounts` (snapshot đầy đủ bảng) và `functions` (định nghĩa
   RPC cũ). JSON mật khẩu đã biết là ánh xạ username/email → mật khẩu. Công cụ
   không đoán mật khẩu và sẽ dừng nếu có giá trị sai; không ghi đè file output cũ.
   Các file mang tên ngày ở ví dụ là dữ liệu local, không nằm trong repository.

4. Trong cửa sổ bảo trì, chạy **nguyên artifact SQL cục bộ**, không chạy trực tiếp
   migration trên Git với bảng có tài khoản. Artifact đưa dữ liệu đã xác minh và
   snapshot vào bảng tạm trong cùng transaction, rồi xác nhận
   `RESET_UNKNOWN_ACCOUNT_PASSWORDS`. Thiếu xác nhận/dữ liệu giữ lại hoặc snapshot
   thay đổi thì rollback; bảng tạm được gỡ khi commit. Nếu snapshot đã cũ, chuẩn bị
   lại backup/artifact thay vì gỡ kiểm tra để ép chạy.

5. Bật backend mới và kiểm tra đăng nhập theo từng vai trò, tạo tài khoản, đổi
   mật khẩu, phiên cũ và quyền kho. Không để backend cũ chạy với schema mới.
6. Mật khẩu admin/test đã biết vẫn dùng như cũ. Dùng Supabase Table Editor để xem
   mật khẩu được đặt lại của tài khoản khác; cập nhật file local nếu cần.

Migration dùng transaction, lock/statement timeout, `DROP ... RESTRICT`,
không xóa tài khoản và không dùng CASCADE. Nó xóa RPC v1 và cột hash, tạo RPC v2;
không áp dụng lặp lại. Cần backup để rollback toàn bộ schema/RPC/mật khẩu cũ,
không chỉ đổi ngược tên cột.

## Kiểm thử không dùng database thật

```powershell
.venv\Scripts\python.exe -m pytest tests/test_password_storage.py tests/test_admin_accounts.py tests/test_shared_auth.py -q
.venv\Scripts\python.exe scripts/export_openapi.py --check
```

SQL test biệt lập dùng PGlite (cài ngoài repo), đặt `PHUB_PGLITE_MODULE` trỏ tới
`@electric-sql/pglite/dist/index.cjs`, rồi chạy từ gốc repo:

```powershell
node Backend/tests/plaintext-passwords-sql.test.cjs
```

SQL test kiểm tra xác nhận/rollback, dữ liệu giữ lại bị cũ, không còn cột hash, giữ
mật khẩu đã biết và reset riêng từng tài
khoản, giữ trạng thái/người liên kết, đăng ký/tạo tài khoản với mật khẩu dạng chữ,
quyền RPC và đổi mật khẩu có điều kiện, không truy cập Supabase chung.

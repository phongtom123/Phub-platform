# Chức năng sao lưu và phục hồi database

## 1. Mục tiêu

Chức năng giúp PHUB tạo bản sao lưu database Supabase theo từng mốc thời gian, kiểm tra tính toàn vẹn của bản sao, phục hồi thử vào PostgreSQL local và tự động quản lý dung lượng lưu trữ.

## 2. Chức năng chính

### Sao lưu database

- Kết nối tới PostgreSQL của Supabase qua Session Pooler và SSL.
- Xuất các schema nghiệp vụ thành file `phub-app.dump` bằng `pg_dump` định dạng custom.
- Mỗi lần sao lưu tạo một thư mục theo dạng `yyyyMMdd-HHmmss`.
- Chỉ công nhận backup thành công khi file có dữ liệu và `pg_restore --list` đọc được danh mục đối tượng.
- Tạo `manifest.json` chứa thời điểm, dung lượng, SHA-256, danh sách schema và phiên bản PostgreSQL client.
- Ghi log riêng để tra cứu khi sao lưu thất bại.

### Phục hồi theo mốc thời gian

- Mặc định chọn bản backup thành công mới nhất.
- Có thể nhập một thời điểm cụ thể; hệ thống chọn bản mới nhất nhưng không muộn hơn thời điểm đó.
- Kiểm tra SHA-256 trước khi phục hồi để phát hiện file bị thay đổi hoặc hỏng.
- Chỉ cho phép phục hồi thử vào `localhost`, `127.0.0.1` hoặc `::1`.
- Database đích bắt buộc có tiền tố `pchub_restore_test_`, tránh phục hồi nhầm vào Supabase production.
- Sau khi phục hồi, hệ thống kiểm tra số bảng, hàm, khách hàng và đơn hàng, rồi lưu kết quả thành file JSON.

### Chạy tự động theo lịch

- Hỗ trợ đăng ký Windows Task Scheduler.
- Lịch mặc định trong cấu hình mẫu là `02:00` mỗi ngày.
- Không chạy hai phiên backup đồng thời.
- Có thể chạy khi người dùng đang đăng nhập hoặc cả khi đã đăng xuất.

### Quản lý dung lượng

- Giới hạn theo số ngày lưu, tổng dung lượng thư mục và dung lượng trống tối thiểu của ổ đĩa.
- Trước khi tạo backup mới, hệ thống ước lượng dung lượng cần thiết và dọn chỗ nếu thiếu.
- Khi vượt giới hạn, hệ thống xóa **bản backup thành công cũ nhất** từng bản một rồi kiểm tra lại.
- Luôn bảo vệ bản vừa tạo hoặc bản mới nhất và giữ tối thiểu số lượng backup đã cấu hình.
- Nếu đã xóa hết các bản được phép xóa mà vẫn thiếu dung lượng, tiến trình dừng và báo lỗi thay vì xóa điểm phục hồi cuối cùng.

## 3. Bảo mật

- Không lưu mật khẩu database trong Git hoặc file JSON.
- Mật khẩu được lưu trong credential file mã hóa bằng Windows DPAPI, chỉ tài khoản Windows đã tạo file mới đọc được.
- Có thể dùng biến môi trường `PHUB_SUPABASE_DB_PASSWORD` và `PHUB_LOCAL_DB_PASSWORD` trong môi trường vận hành riêng.
- `config.local.json`, file `.dump` và `.backup` đã được loại khỏi Git.

## 4. Phạm vi dữ liệu

Cấu hình mẫu sao lưu các schema:

- `public`
- `admin_ops`
- `admin_account_private`
- `customer_order_private`
- `payment_demo`
- `portal_auth`
- `supabase_migrations`

Database backup chỉ chứa dữ liệu và metadata trong PostgreSQL. Nội dung file ảnh/tệp của Supabase Storage không nằm trong bản database backup và phải được sao lưu riêng bằng S3 hoặc rclone.

## 5. Luồng hoạt động

1. Đọc cấu hình và credential được mã hóa.
2. Kiểm tra công cụ PostgreSQL và dung lượng ổ đĩa.
3. Xóa tuần tự các backup cũ nhất nếu cần giải phóng dung lượng.
4. Chạy `pg_dump` vào thư mục tạm.
5. Kiểm tra danh mục bằng `pg_restore --list`.
6. Tạo SHA-256 và `manifest.json`.
7. Đổi thư mục tạm thành backup hoàn chỉnh và cập nhật file `LATEST`.
8. Áp dụng lại chính sách lưu giữ sau khi backup thành công.
9. Khi phục hồi, chọn bản theo mốc thời gian, kiểm tra hash, tạo database local mới, restore và đối chiếu dữ liệu.

## 6. Cấu hình mặc định

| Cấu hình | Giá trị mẫu |
|---|---:|
| Thời gian chạy | 02:00 mỗi ngày |
| Thời gian lưu tối đa | 30 ngày |
| Tổng dung lượng backup | 20 GB |
| Dung lượng trống tối thiểu | 5 GB |
| Số backup thành công tối thiểu | 2 |
| Dung lượng dự kiến cho lần đầu | 1 GB |

Các giá trị có thể thay đổi trong `Backend/scripts/database-backup/config.local.json`.

## 7. Vị trí mã nguồn

| Thành phần | Tệp |
|---|---|
| Backup Supabase | `Backend/scripts/database-backup/Backup-SupabaseDatabase.ps1` |
| Phục hồi thử | `Backend/scripts/database-backup/Test-RestoreBackup.ps1` |
| Cài lịch tự động | `Backend/scripts/database-backup/Install-BackupSchedule.ps1` |
| Lưu credential | `Backend/scripts/database-backup/Save-BackupCredential.ps1` |
| Chính sách dung lượng/mốc thời gian | `Backend/scripts/database-backup/PhubBackup.Common.ps1` |
| Cấu hình mẫu | `Backend/scripts/database-backup/config.example.json` |
| Hướng dẫn vận hành chi tiết | `Backend/docs/SUPABASE-BACKUP-RESTORE.md` |

## 8. Kết quả kiểm thử

- Các script đã qua kiểm tra cú pháp Windows PowerShell 5.1.
- Kiểm thử retention xác nhận xóa bản cũ nhất và giữ bản mới nhất.
- Kiểm thử tích hợp đã chạy thật với PostgreSQL tạm: tạo dump, kiểm tra catalog, tạo SHA-256, phục hồi, kiểm tra quan hệ và đối chiếu số bản ghi thành công.
- Chưa chạy backup trên Supabase production vì cần host Session Pooler và credential database thật.

## 9. Giới hạn

- Backup logical chỉ phục hồi được tại những mốc đã chạy backup.
- Point-in-Time Recovery của Supabase có thể phục hồi gần như tới từng thời điểm nhưng là add-on trả phí và không được tự động bật từ mã nguồn.
- Phục hồi database không đồng nghĩa toàn bộ API, Auth và Storage đã được phục hồi đầy đủ.

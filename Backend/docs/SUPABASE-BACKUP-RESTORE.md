# Sao lưu và phục hồi database PHUB

Bộ script tại `Backend/scripts/database-backup` tạo logical backup theo từng mốc thời gian, kiểm tra SHA-256 và khả năng đọc của `pg_restore`, phục hồi thử vào PostgreSQL local, cài lịch Windows và tự dọn dung lượng.

## Nguyên tắc an toàn

- Không lưu mật khẩu trong Git hoặc file JSON. Credential được mã hóa bằng Windows DPAPI và chỉ tài khoản Windows đã tạo file mới giải mã được.
- Khi thiếu dung lượng, script xóa **bản thành công cũ nhất** từng bản một. Bản vừa tạo/mới nhất luôn được bảo vệ và vẫn giữ số bản tối thiểu cấu hình. Xóa bản gần nhất sẽ làm mất điểm phục hồi tốt nhất nên không được thực hiện.
- Restore test chỉ chấp nhận `localhost`, `127.0.0.1` hoặc `::1`, và database có tiền tố `pchub_restore_test_`. Script không phục hồi đè lên Supabase production.
- Database backup không chứa nội dung file Supabase Storage; cần sao lưu Storage riêng bằng S3/rclone nếu muốn bảo vệ ảnh và tệp.

## Thiết lập lần đầu

1. Trong Supabase Dashboard mở **Connect → Session pooler**, lấy đúng host, port, database và user. Không dùng API key thay mật khẩu database.
2. Sao chép `config.example.json` thành `config.local.json`, điền host thật và điều chỉnh thư mục/dung lượng/lịch. `config.local.json` đã được `.gitignore`.
3. Lưu credential:

```powershell
$backupScripts = "Backend\scripts\database-backup"
& "$backupScripts\Save-BackupCredential.ps1" -Target Supabase -ConfigPath "$backupScripts\config.local.json"
& "$backupScripts\Save-BackupCredential.ps1" -Target LocalPostgres -ConfigPath "$backupScripts\config.local.json"
```

Máy hiện có PostgreSQL client 18. Để kiểm thử phục hồi, cần cài thêm PostgreSQL Server local (17 hoặc 18) và bảo đảm dịch vụ chạy ở cổng trong config.

## Chạy backup và chọn mốc phục hồi

```powershell
& "$backupScripts\Backup-SupabaseDatabase.ps1" -ConfigPath "$backupScripts\config.local.json"

# Phục hồi bản mới nhất vào database local mới
& "$backupScripts\Test-RestoreBackup.ps1" -ConfigPath "$backupScripts\config.local.json"

# Chọn bản gần nhất nhưng không muộn hơn mốc này
& "$backupScripts\Test-RestoreBackup.ps1" -ConfigPath "$backupScripts\config.local.json" -At "2026-11-11 20:00:00+07:00"
```

Mỗi thư mục backup gồm `phub-app.dump`, `manifest.json`, log và kết quả restore test. Restore test giữ database local để đối chiếu thủ công.

## Cài lịch tự động

Giờ mặc định trong ví dụ là 02:00 mỗi ngày:

```powershell
& "$backupScripts\Install-BackupSchedule.ps1" -ConfigPath "$backupScripts\config.local.json"
```

Mặc định task chạy khi tài khoản đang đăng nhập. Dùng `-RunWhenLoggedOff` nếu muốn chạy cả khi đăng xuất; Windows sẽ hỏi mật khẩu tài khoản để đăng ký task.

## Giới hạn của mốc thời gian

Các file logical backup chỉ phục hồi được tới những thời điểm đã chạy backup. Supabase PITR cho phép chọn gần như bất kỳ thời điểm nào với RPO tối đa khoảng hai phút, nhưng là add-on trả phí cho Pro/Team/Enterprise và yêu cầu compute tối thiểu Small. Không bật PITR tự động từ mã nguồn vì thao tác này phát sinh chi phí.

# Hồ sơ CRM khách hàng — Admin, đợt 1

## Phạm vi đã triển khai trong mã

- Giữ URL `/data/customers`; `key=` trống là danh sách, chọn mã khách để mở chi tiết.
- Chi tiết cùng đường dẫn cũ: `/data/customers?key=["MA_KH_THAT"]` (trình duyệt sẽ URL-encode).
- Hồ sơ có ngày sinh, tuổi tính theo ngày tại Việt Nam, sở thích và mốc thời gian.
- Hồ sơ cũ không biết ngày tạo hiển thị "Chưa có thông tin", không điền ngày migration.
- Tài khoản liên kết: mã, username, email, trạng thái; đi tới trang tài khoản để quản lý.
- Lịch sử đơn hàng lọc đúng khách, tải khi bấm mở và phân trang 10 đơn/lần.
- Chỉnh sửa hồ sơ và nhiều sở thích trong cùng giao dịch SQL; bỏ chọn tất cả gửi `[]`.
- Bỏ trường sở thích khỏi PATCH thì giữ nguyên; sở thích cũ ngừng hoạt động vẫn được
  giữ lại nhưng không cho chọn mới sau khi đã bỏ.
- Lưu dùng snapshot server trả về, không reload document hoặc tải lại cả hồ sơ.
- Cache theo phiên, mutation invalidation, polling 10 giây khi không chỉnh sửa và tab
  hiển thị; không coi polling là realtime.
- ADMIN mới được dùng API này. THU_KHO và KHACH_HANG bị từ chối ở backend.

Chưa làm giao diện tự phục vụ CRM phía khách, lưu trữ/khôi phục khách, phản hồi,
khảo sát hoặc báo cáo tổng hợp. Không coi KAN-41 hoặc KAN-40 hoàn thành toàn bộ
chỉ vì đã có bản nâng cấp Admin này. Không tự thay đổi ticket Jira.

## Chuẩn bị database

1. Backup và thử trên DB test trước.
2. Nếu đã áp dụng đợt 1 với `SO_THICH`, `KHACH_HANG_SO_THICH` và 4 cột hồ sơ thì
   **không chạy lại** script tạo bảng:
   [20261022_crm_customer_profile_interests.sql](../Backend/migrations/20261022_crm_customer_profile_interests.sql).
3. Chạy **script bổ sung** bằng role `postgres` trong Supabase SQL Editor:
   [20261022_crm_admin_profile_api.sql](../Backend/migrations/20261022_crm_admin_profile_api.sql).
   Script kiểm tra cấu trúc đợt 1 trước, chỉ thêm/cập nhật RPC và quyền EXECUTE;
   không tạo lại bảng và không thay đổi dữ liệu khách cũ.
4. DB trống mới dựng: chạy initial schema, rồi lần lượt migration CRM đợt 1 và 1B.
   Các migration nghiệp vụ cũ như tạo tài khoản/checkout vẫn có yêu cầu riêng.
5. Deploy/restart backend **và** cập nhật frontend. Nếu frontend đang trỏ Render,
   backend trên Render cũng phải có mã mới, không chỉ chạy SQL là đủ.

Không chạy tự động các bước trên lên Supabase production. SQL đã được kiểm thử
trong PostgreSQL nhúng/PGlite biệt lập, nhưng chưa kiểm chứng schema, quyền,
trigger hiện hữu và PostgREST của project Supabase thật.

## API

| Phương thức | Đường dẫn backend | Công dụng |
|---|---|---|
| GET | `/api/crm/customers/{ma_kh}` | Hồ sơ, tài khoản công khai, sở thích và danh mục |
| PATCH | `/api/crm/customers/{ma_kh}` | Lưu hồ sơ và/hoặc sở thích nguyên tử |
| GET | `/api/crm/customers/{ma_kh}/orders?page=1&page_size=10` | Đơn hàng của đúng khách |

Browser gọi `/api/backend/crm/...` qua gateway Next.js; không gọi DB trực tiếp.
Chỉ forward các đường dẫn/phương thức đã cho phép và cookie phiên/Origin.
Không đưa Supabase secret/service key vào browser.

Ví dụ body PATCH, thay bằng dữ liệu khách được phép chỉnh sửa:

```json
{
  "ngay_sinh": "2000-02-29",
  "so_thich": ["GAMING", "VAN_PHONG"]
}
```

- Ngày sinh `null` để xóa giá trị; không nhận ngày tương lai hoặc ngày không tồn tại.
- Trường có thể sửa: `ten_kh`, `sdt`, `dia_chi_chi_tiet_md`, `tinh_thanh_md`,
  `xa_phuong_md`, `ngay_sinh`, `so_thich`.
- Không nhận `ma_kh`, email, trạng thái tài khoản, ngày tạo/cập nhật hoặc `luu_tru_luc`
  trong body. Thay đổi email/trạng thái đi qua nghiệp vụ tài khoản hiện hữu.
- RPC kiểm tra lại ADMIN còn hoạt động ngay tại thời điểm ghi; chỉ `service_role`
  được EXECUTE. Tất cả thao tác thay đổi hồ sơ/sở thích cùng transaction.
- Thiếu RPC trả 503 có tên migration cần chạy; draft trên form được giữ để retry.
- Metadata generic đọc thêm `date`/`timestamptz`, ngày tạo/cập nhật/lưu trữ là trường
  hệ thống, không tạo input cho người dùng sửa. Hai bảng sở thích không được mở
  thành generic CRUD không kiểm tra nghiệp vụ.

## Kiểm thử

Backend (offline, chặn HTTP thật):

```powershell
cd Backend
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe scripts/export_openapi.py --check
```

Admin và gateway (HTTP giả lập):

```powershell
cd ui/adminUI
node node_modules/typescript/bin/tsc --noEmit
node --test tests/*.test.cjs
node --test ../shared/tests/*.test.cjs
```

Browser: chạy frontend Admin ở cổng 3000 rồi chạy
`tests/customer-detail.e2e.cjs` và `tests/page-actions.e2e.cjs`.
Đặt `PHUB_PLAYWRIGHT_MODULE` nếu Playwright ở thư mục tooling ngoài repo;
`PHUB_CHROMIUM_EXECUTABLE` để chỉ định Chromium đã cài, `PHUB_ADMIN_TEST_URL`
để đổi URL kiểm thử. Toàn bộ API trong browser test bị chặn và trả mock,
không chuyển request ghi tới backend thật.

SQL: `Backend/tests/crm-profile-sql.test.cjs` dùng package `@electric-sql/pglite`
ở môi trường tooling riêng (hoặc biến `PHUB_PGLITE_MODULE`). Test dựng DB RAM,
áp dụng cả hai migration CRM, kiểm tra NULL cũ, timestamp, quyền, ngày sinh,
sở thích ngừng hoạt động và rollback khi lỗi xuất hiện giữa giao dịch.
Không đọc `.env`, không kết nối Supabase, không thay dependencies runtime của app.

## Smoke test sau khi triển khai được phép

- [ ] Mở danh sách khách, chọn một khách thật; trường cũ/NULL hiển thị đúng.
- [ ] Chọn nhiều sở thích, đổi ngày sinh, lưu; kiểm tra DB và UI cùng kết quả.
- [ ] Thử ngày tương lai, tài khoản sai role, mã khách không tồn tại.
- [ ] Mở lịch sử và trang 2; không có đơn của khách khác.
- [ ] Đăng xuất/đổi tài khoản không thấy dữ liệu cache của phiên trước.
- [ ] Thử trên project test với PostgREST; ghi nhận kết quả trước khi triển khai thật.

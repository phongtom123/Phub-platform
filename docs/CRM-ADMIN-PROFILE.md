# Hồ sơ khách hàng — Admin

## Phạm vi hiện tại

Ngày 23/10/2026 đã bỏ chức năng sở thích theo yêu cầu, xóa hai bảng
`SO_THICH`, `KHACH_HANG_SO_THICH` trong Supabase project **Phub**
(`btfhahnjydaiivvcqnna`). Không thay đổi khách hàng, tài khoản, đơn hàng,
ticket hỗ trợ hoặc các bảng kho. Project Phub1 không bị tác động.

- Giữ URL `/data/customers`; chọn mã khách để mở chi tiết.
- Hồ sơ gồm tên, điện thoại, địa chỉ, ngày sinh/tuổi và mốc thời gian.
- Giữ tài khoản liên kết và lịch sử đơn lọc đúng khách, phân trang 10 đơn/lần.
- Không còn ô chọn, danh mục hay dữ liệu sở thích trong UI/API.
- PATCH chỉ nhận trường hồ sơ. `so_thich` hiện là trường không hợp lệ (422).
- Lưu dùng snapshot từ RPC, không reload toàn trang hoặc refetch sau khi lưu.
- Chỉ ADMIN được đọc/sửa hồ sơ này; quyền và Origin vẫn được kiểm tra.
- Cache tách phiên, invalidation khi ghi và polling 10 giây khi không chỉnh sửa.
- Không đổi ngày tạo NULL của hồ sơ cũ thành ngày migration.

## Triển khai database và mã

Migration hiện tại:
[20261023012955_remove_customer_interests.sql](../Backend/migrations/20261023012955_remove_customer_interests.sql).

Migration tạo RPC `admin_update_customer_profile_v2(text,text,jsonb)`, gỡ RPC
lưu sở thích cũ nếu có, xóa đúng hai bảng bằng RESTRICT và gỡ trigger function
riêng của sở thích. Không dùng CASCADE. Các trigger hồ sơ khách được giữ nguyên.

Đã sao lưu 3 mục sở thích và 0 liên kết khách trước khi xóa, lưu backup JSON và
script restore ngoài repository, đồng thời thử restore trong PGlite biệt lập.
Khi áp dụng, kiểm tra snapshot dưới khóa bảng và rollback nếu dữ liệu đã thay đổi.

**Không chạy lại migration trên Phub.** Nếu dựng database mới, các migration CRM
ngày 22/10 là lịch sử: chạy theo thứ tự rồi áp dụng migration bỏ sở thích cuối cùng.
Không xóa/sửa lịch sử migration để mô phỏng một database chưa từng có hai bảng.

**Cần deploy backend và frontend mới.** Theo lựa chọn của người dùng, bảng thật đã
được xóa ngay sau backup, trước khi deploy: backend Render cũ vẫn gọi hai bảng nên
trang hồ sơ khách có thể tạm lỗi cho đến khi cập nhật mã. Chưa push/deploy mã thay
đổi trong lượt xóa bảng. Admin local dùng API Render, không tự chuyển sang backend local.

## API

| Phương thức | Đường dẫn | Công dụng |
|---|---|---|
| GET | `/api/crm/customers/{ma_kh}` | `{profile, account}`, không đọc hai bảng đã xóa |
| PATCH | `/api/crm/customers/{ma_kh}` | Lưu các trường hồ sơ bằng một RPC |
| GET | `/api/crm/customers/{ma_kh}/orders` | Đơn của đúng khách, phân trang |

Browser gọi gateway `/api/backend/crm/...`; không gọi Supabase trực tiếp.

Ví dụ PATCH:

```json
{"ngay_sinh":"2000-02-29","sdt":"0901234567"}
```

Trường cho sửa: `ten_kh`, `sdt`, `dia_chi_chi_tiet_md`, `tinh_thanh_md`,
`xa_phuong_md`, `ngay_sinh`. Bỏ trường khỏi PATCH sẽ giữ nguyên; null xóa giá trị
nullable. Không nhận PK/email/trạng thái tài khoản/các mốc thời gian/lưu trữ.
RPC kiểm tra lại ADMIN hoạt động ngay khi ghi, khóa hồ sơ và chỉ cấp EXECUTE cho
service_role; trả hồ sơ cùng tài khoản công khai, không trả mật khẩu/hash.

## Kiểm thử

- `Backend/tests/test_crm.py`: GET không đọc bảng cũ, PATCH dùng RPC mới, phân quyền,
  Origin, validation, lỗi an toàn và lịch sử đơn.
- `Backend/tests/remove-interests-sql.test.cjs`: SQL trên DB RAM, xóa bảng có dữ liệu,
  giữ khách/kho/ticket, RPC mới, rollback và quyền; có thể kiểm thử file backup bằng
  `PHUB_INTEREST_RESTORE_SQL`. Không kết nối database thật.
- `Backend/tests/crm-profile-sql.test.cjs`: kiểm tra lịch sử migration CRM cũ,
  không có nghĩa tính năng sở thích vẫn đang dùng.
- `ui/adminUI/tests/customer-detail.e2e.cjs`: UI không còn sở thích, sửa/lưu không
  reload, lỗi giữ draft, tài khoản liên kết, lịch sử đơn và mobile; API hoàn toàn mock.
- Sau deploy: smoke test bằng tài khoản Admin thật, kiểm tra ngày sinh NULL, lưu
  hồ sơ, lịch sử đơn và đăng xuất; không seed ticket hoặc sửa khách thật tự động.

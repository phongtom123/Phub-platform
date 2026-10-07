# Test phần khách hàng trên UI

**Lựa chọn mới 07/10/2026:** chưa thực thi đặt đơn/thanh toán trên Supabase;
test đầy đủ UI với fixture riêng. Xem [PAYMENT-UI-REVIEW.md](PAYMENT-UI-REVIEW.md)
để thử bảng giá/hóa đơn, chọn phương thức và mô phỏng trạng thái ngay trên UI đơn.

**Test trên Supabase thật với khách đầu tiên đã được cho phép:** dùng
`-Mode SupabaseTest`, mở trực tiếp http://127.0.0.1:3001/; bước đăng nhập đã tạm
ngắt, backend tự dùng khách đầu tiên. `-RequireTestSession` bật lại phiên cookie.
Hướng dẫn và RPC còn thiếu:
[CUSTOMER-SUPABASE-TESTING.md](CUSTOMER-SUPABASE-TESTING.md).
Catalog/hồ sơ/giỏ đã kiểm tra trên database thật; đặt đơn còn cần cài RPC.

Bốn mục tiêu đã nối: catalog/chi tiết, giỏ/checkout/voucher/đơn và trạng thái/lịch
sử thanh toán. Chạy trực tiếp mã nguồn nhánh **ui-review**, không tạo bản sao.
Phần đăng ký/đăng nhập giữ trách nhiệm thành viên phụ trách.

Kết quả backend hiện tại: 370 Python tests, TypeScript và lint
đạt; 15 nhóm E2E nghiệp vụ + 5 nhóm test trang khách mẫu/thanh toán bằng UI đạt.
Đã sửa và kiểm tra lại lỗi voucher bị mất khi điều hướng từ giỏ sang checkout.

## Test toàn luồng bằng fixture riêng

Từ thư mục gốc:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Demo
```

Mở **http://127.0.0.1:18001/__manual** → chọn **Mở giao diện với khách A**.
Sau đó bạn thao tác trong UI thật ở http://127.0.0.1:13001/main/product.
Nếu server đang chạy, chỉ mở link; không chạy lệnh start lần nữa.

Chế độ này dùng API mua hàng đã viết với database/phiên khách mẫu riêng trong RAM.
Không đăng nhập bằng mật khẩu, không ghi dữ liệu vào Supabase chung. Dữ liệu đơn
mất khi khởi động lại. Đây là cách test phần mình phụ trách khi module đăng nhập
chưa được thành viên khác nối vào backend.

## Các chức năng cần kiểm tra

| Chức năng | Cách thao tác | Kết quả mong đợi |
| --- | --- | --- |
| Catalog/chi tiết | Mở sản phẩm SKU-A, xem mô tả/thông số | Dữ liệu từ API, có giá và dòng đỏ “chưa áp dụng thuế 10%” |
| Giỏ hàng | Thêm, sửa số lượng, xóa, tải lại trang | Header và giỏ đồng bộ; giỏ giữ theo từng khách |
| Tồn kho | Đặt số lượng trên 5 trong giỏ mẫu | Báo không đủ tồn, không tạo đơn |
| Voucher | Nhập mã sai rồi `SAVE10` | Mã sai báo lỗi; mã đúng giảm 10% từ backend |
| Người nhận | Checkout, thử bỏ trống hoặc nhập sai điện thoại | Validation báo lỗi; địa chỉ/người nhận hiển thị ở bước xác nhận |
| Đặt đơn | Lưu thông tin nếu thiếu → xác nhận giá/địa chỉ → Đặt đơn | Mở chi tiết đơn; tổng được backend tính, không cộng thuế hóa đơn |
| Lịch sử đơn | Mở `/main/profile`, chọn “Đơn hàng của tôi” | Thấy đơn của đúng khách; mở lại chi tiết được |
| Chưa thanh toán | Mở đơn vừa tạo | Ghi rõ chưa có giao dịch, chưa xác nhận thanh toán |
| Chờ/thành công/thất bại/hoàn | UI đơn: chọn phương thức → Yêu cầu thanh toán → nút Mô phỏng | UI hiện phương thức, số tiền, trạng thái và lịch sử; không lộ mã nhạy cảm |
| Quyền xem đơn | Chép URL đơn A, chọn khách B rồi mở URL đó | Không xem được đơn hoặc thanh toán của A |
| Khách chưa đăng nhập | Chọn “Xem khi chưa đăng nhập” | Xem catalog được; giỏ/checkout/đơn yêu cầu đăng nhập |
| Desktop/mobile | Dùng DevTools đổi chiều rộng 375 và 1280 px | Cùng luồng mua hàng, không tràn ngang trang |

SKU-A giá 100.000,10 ₫, tồn 5. Một chiếc với SAVE10 có tổng **90.000,09 ₫**;
hai chiếc có tổng **180.000,18 ₫**. Thuế 10% áp khi lập hóa đơn, không cộng lúc
đặt. Tạo đơn giữ hàng, không trừ tồn thực; kho trừ sau phiếu xuất.

Trang điều khiển thanh toán chỉ ghi dữ liệu mẫu cho **đơn mới nhất của khách A**.
Reset xóa đơn/payment mẫu, giữ phiên; giỏ trình duyệt vẫn có thể sửa/xóa qua UI.
Ảnh mẫu là placeholder; chế độ Demo không chứng nhận chức năng SQL trên Supabase.

## Test catalog với Supabase thật

Dừng Demo trước khi dùng dev mode Real:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Demo
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Real
```

UI **http://127.0.0.1:3001/main/product**, Swagger **http://127.0.0.1:8001/docs**.
Real cần `Backend/.env` hiện có. Test tìm tên/SKU, lọc loại/thương hiệu, phân
trang, giá tăng/giảm, mở chi tiết ảnh/mô tả/thông số trên desktop/mobile bằng
dữ liệu Supabase hiện tại. Catalog mẫu chỉ có một sản phẩm để test mua hàng;
hãy dùng Real để kiểm tra lọc/sắp xếp với danh sách nhiều sản phẩm.

**Để đặt đơn thật trên Supabase:** cần dependency danh tính khách đã xác minh và
migration được nhóm áp vào database kiểm thử. API khách hiện chặn bằng
`503 AUTH_INTEGRATION_REQUIRED`. Không bỏ xác thực hoặc dùng ma_kh client tự gửi
để thay phần đăng nhập. Chưa áp migration lên database chung trong lần làm này.

## Chạy lại và sửa lỗi

Start mặc định chạy Next dev từ source hiện tại, tự cập nhật UI khi sửa file.
Sau khi sửa backend, dừng/start lại đúng mode. Log/PID ở `.customer-runtime`;
nếu không mở được trang, kiểm tra log `Demo-api-error.log`, `Demo-ui-error.log`
hoặc các file `Real-*`. Script không tự dừng tiến trình đang dùng cổng.

Các server đang dùng production build cần build lại để thấy thay đổi frontend;
để sửa/test liên tục, dừng cả hai mode rồi start mode cần dùng **không có**
`-Production`. Không build trong khi hai frontend production đang phục vụ.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Demo
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-customer.ps1 -Mode Real
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-customer.ps1 -Mode Demo
```

Python tests: từ Backend chạy `.\.venv\Scripts\python.exe -m pytest -q`.
Browser harness: [SHOPPING-INTEGRATION.md](ui/userUI/Frontend/SHOPPING-INTEGRATION.md)
và [CUSTOMER-DEPLOYMENT.md](CUSTOMER-DEPLOYMENT.md) có lệnh chuẩn bị Playwright/key.
`scripts/check-shopping.mjs` kiểm tra 15 nhóm nghiệp vụ; `scripts/check-manual-shopping.mjs`
kiểm tra thêm trang chọn khách mẫu và các nút kịch bản thanh toán bằng UI.

Tài liệu code/backend: [Backend README](Backend/README.md). Cấu hình Render đã
chuẩn bị trong [CUSTOMER-DEPLOYMENT.md](CUSTOMER-DEPLOYMENT.md) để bạn tự triển khai
sau khi test; chưa deploy, push hoặc chạy migration tự động.

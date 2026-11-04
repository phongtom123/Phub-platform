# Nhận hàng tại cửa hàng

Cập nhật 04/11/2026 theo yêu cầu: chỉ hiển thị **Nhận tại cửa hàng**,
không cần địa chỉ cửa hàng, không tạo bảng địa điểm hoặc dùng kho làm điểm nhận.

- Một cột mới: `DON_HANG.phuong_thuc_nhan`, nhận `GIAO_HANG` hoặc
  `TAI_CUA_HANG`. Đơn lịch sử giữ `NULL`, không tự suy diễn phương thức nhận.
  Đơn web mới mặc định giao hàng nếu request không chỉ định phương thức.
- Checkout có hai radio; nhận tại cửa hàng chỉ nhập tên và số điện thoại.
  Không tạo địa chỉ giả, không ghi vào sổ địa chỉ và không sửa hồ sơ khách.
  Địa chỉ/tỉnh/phường trên đơn nhận tại cửa hàng là NULL.
- Đơn vẫn có `kenh_ban=ONLINE`. Chỉ thay phương thức nhận, không chuyển sang
  `TAI_QUAY`, không khóa vào một kho. Phân bổ hàng từ mọi kho hoạt động vẫn giữ nguyên.
- Hóa đơn tạo cùng transaction, giữ hàng theo chính sách hiện tại; không tự
  thu tiền hoặc trừ tồn vật lý khi chọn nhận tại cửa hàng. Hạn 24 giờ vẫn áp dụng.
  Nhãn tiền mặt đổi thành **Thanh toán tại cửa hàng**; chuyển khoản vẫn dùng được.
- Sau checkout, chi tiết đơn, lịch sử hồ sơ và Admin hiển thị phương thức nhận.
  Đơn nhận tại cửa hàng không hiển thị lỗi thiếu địa chỉ giao hàng.

## Triển khai

Migration: `Backend/migrations/20261104075616_customer_store_pickup.sql`.
Cần các migration pooled-stock/invoice commitment và KAN-61 trước đó.

Migration đã áp dụng trên Supabase. Chỉ thêm cột và hai RPC mới:
`customer_checkout_fulfillment_v1` và `customer_read_orders_v4`. Các RPC checkout
cũ, read v2/v3 giữ nguyên để backend đang deploy tiếp tục hoạt động.
Hàm mới SECURITY INVOKER, search_path rỗng, chỉ cấp EXECUTE cho service_role.

Backend/UI cần deploy mã mới để có lựa chọn này trên Render. Local đang chạy
user UI 3001, API 8000. Deploy Render thực hiện riêng sau khi merge nhánh
chứa thay đổi này vào nhánh mà dịch vụ đang theo dõi.

Giữ idempotency: request giao hàng tiếp tục dùng canonical hash cũ. Pickup
đưa phương thức nhận và contact vào hash; cùng key không được đổi sang giao hàng,
đổi khách hoặc đổi nội dung. Replay giữ hóa đơn, hạn và receipt ban đầu.

## Kiểm thử

- `Backend/scripts/test_store_pickup.cjs`: PostgreSQL PGlite biệt lập; tạo đơn
  pickup, hóa đơn 10% và hạn 24 giờ, replay, chuyển phương thức cùng key bị chặn,
  shipping legacy replay, request sai bị từ chối, read ownership và ACL.
- 433 pytest đạt: commerce, customer reads, payment, admin order detail,
  admin operations, OpenAPI và kiến trúc. TypeScript cả user/Admin và ESLint
  các file user thay đổi đều đạt.
- `ui/userUI/Frontend/tests/store-pickup.e2e.cjs`: 1440px/390px, sổ địa chỉ trống,
  có địa chỉ và lỗi 503; chuyển lựa chọn, kiểm tra contact, receipt/hóa đơn/hạn,
  chi tiết đơn. Fixtures chặn toàn bộ API; không tạo đơn thật.
- Test checkout giao tận nơi/hóa đơn tự động hiện có vẫn đạt.
- Trước/sau migration Supabase: 31 đơn, 13 hóa đơn, 17 giao dịch, 372 dòng tồn;
  checksum dữ liệu cũ không đổi, cả 31 đơn cũ có phương thức nhận NULL.
  Backend mới đọc được page/detail/invoice thật; không thử ghi đơn/thanh toán thật.

# Tổng tiền giỏ hàng, lưu thông tin nhận hàng và xác nhận đơn

Cập nhật tiếp theo: [PAYMENT-UI-REVIEW.md](PAYMENT-UI-REVIEW.md) bổ sung bảng giá/
thành tiền, chọn phương thức và hóa đơn/thanh toán/lịch sử đầy đủ trên UI fixture.
Các mô tả phần chưa nối bên dưới ghi lại trạng thái của đợt sửa trước.

Thay đổi ngày 07/10/2026 trên nhánh `ui-review`. Giữ nguyên cấu trúc database,
UI đăng nhập của thành viên khác và nghiệp vụ kho. Dùng UI/backend hiện có.

## Hành vi mới

1. Giỏ có dòng **Tổng tiền sản phẩm đã chọn** ngay trên hai nút cuối danh sách,
   căn bên phải phía trên Thanh toán. Tổng là đơn giá catalog × số lượng của
   các dòng được chọn, cập nhật ngay khi chọn/bỏ chọn hoặc đổi số lượng.
   Dùng BigInt theo đơn vị nhỏ nhất, không cộng tiền bằng số thực. Đây là tổng
   tiền sản phẩm trước voucher/thuế; giá cuối cùng lấy từ báo giá backend.
2. `/checkout` chỉ hiện form nhận hàng nếu khách thiếu tên, điện thoại hoặc địa chỉ.
   Nút **Lưu** thay Kiểm tra đơn, không bị khóa vì báo giá chưa hoạt động.
   Lưu thành công vào database rồi mở `/checkout/confirm`. Có đủ thông tin thì
   tự mở trang xác nhận; **Sửa thông tin nhận hàng** cho phép mở lại form.
3. Trang `/checkout/confirm` có địa chỉ đã lưu, sản phẩm được chọn, voucher,
   phương thức thanh toán, hóa đơn, ghi chú và **Giá cuối cùng trước thuế**.
   Voucher/giá dựa vào API quote; Đặt đơn dùng API idempotent hiện có.
   Không chọn sản phẩm thì quay về giỏ. Sau đặt thành công, giữ những dòng chưa chọn.

## API Lưu thông tin

`PUT /api/customer/me`, Swagger nhóm **Customer Shopping**:

```json
{
  "name": "Khách thử",
  "phone": "0901234567",
  "address_line": "123 Đường thử",
  "province": "TP Hồ Chí Minh",
  "ward": "Phường thử"
}
```

Chỉ nhận 5 trường này. Khách lấy từ xác thực server, không nhận `ma_kh` từ client.
Kiểm tra trim/rỗng/độ dài/số điện thoại; lỗi thống nhất với các API mua hàng.
Ghi `KHACH_HANG.ten_kh`, `sdt`, `dia_chi_chi_tiet_md`, `tinh_thanh_md`, `xa_phuong_md`.
Không sửa tài khoản, mật khẩu/email hoặc tạo khách mới. Proxy Next cho PUT me
qua cùng kiểm tra origin, kích thước body, Cookie/Authorization và no-store như POST.
Nút Lưu chỉ lưu thông tin nhận hàng, không báo đã tạo đơn/hóa đơn.

Code: `Backend/app/commerce/router.py`, `repository.py`; frontend shopping client,
`ShoppingCart.tsx`, `CheckoutProcess.tsx`, `checkout/confirm/page.tsx` và CSS tương ứng.
Form không lưu địa chỉ vào URL/localStorage; database giữ địa chỉ mặc định,
lần đặt chưa rõ kết quả vẫn giữ body/UUID trong sessionStorage theo cơ chế retry cũ.

## Phần chưa kết nối

Supabase chung còn thiếu `customer_checkout_v2` và `customer_read_orders_v2`.
Khi quote không sẵn sàng, trang xác nhận vẫn mở, hiển thị địa chỉ/sản phẩm và ô
voucher; giá cuối cùng để trống, Đặt đơn bị khóa. Không dùng tổng giỏ để giả báo
giá cuối cùng hoặc giả đặt thành công.

Chưa có API khách hàng để chọn/ghi phương thức thanh toán hoặc lập hóa đơn trong
luồng này. Hai vùng giao diện có tiêu đề và khung trống, đúng yêu cầu phần chưa nối.
Không tự tạo hóa đơn bằng các thao tác ghi rời rạc. Thuế 10% vẫn thuộc bước lập
hóa đơn của nhóm; giá catalog/đặt đơn trước thuế. Không hiển thị mã giao dịch,
reference cổng thanh toán, token, số thẻ/CVV hoặc thông tin giao dịch nội bộ.

## Kiểm tra thủ công

Mở [UI local](http://127.0.0.1:3001/) theo chế độ SupabaseTest trong
[CUSTOMER-SUPABASE-TESTING.md](CUSTOMER-SUPABASE-TESTING.md), không cần đăng nhập.

- Thêm sản phẩm, đổi số lượng và chọn/bỏ chọn để kiểm tra tổng trên Thanh toán.
- Thanh toán: khách test đủ thông tin sẽ đi thẳng xác nhận; bấm Sửa thông tin
  nhận hàng nếu muốn kiểm tra form. **Bấm Lưu sẽ ghi thật vào khách test được phép.**
- Sau Lưu, reload để đối chiếu địa chỉ; quay lại giỏ và Thanh toán để kiểm tra
  form không hiện lần nữa. Thử cả desktop/mobile.
- RPC chưa cài thì giá cuối cùng/phương thức/hóa đơn để trống. Không thể xác nhận
  tạo đơn thật cho tới khi API tương ứng sẵn sàng.

## Kiểm thử

Toàn suite backend đạt **343 tests**, gồm 11 trường hợp mới về API Lưu: validation,
khách chưa liên kết, yêu cầu chưa xác thực, chống giả mã khách, chỉ ghi đúng cột
và giữ dữ liệu tài khoản riêng tư; RLS chặn ghi thì báo lỗi thay vì báo đã lưu.
TypeScript/ESLint của các file sửa đạt.
Build production Webpack đạt, gồm route `/checkout/confirm`.

Đã kiểm tra `PUT /api/customer/me` trên khách test đầu tiên của Supabase thật:
trả 200, đọc lại đúng thông tin đã gửi. Sau kiểm tra, khôi phục và đối chiếu đúng
5 trường ban đầu, gồm các giá trị null; xóa backup tạm. Không thay đổi schema,
tài khoản đăng nhập hoặc dữ liệu đơn/hóa đơn/thanh toán.

`scripts/check-checkout-review.mjs` dùng backend fixture localhost riêng để thử
tổng chính xác, Lưu khi quote lỗi, lưu/đọc lại địa chỉ, bỏ qua form, sửa lại địa chỉ,
voucher/giá cuối cùng và tạo đơn với địa chỉ đã lưu. Vùng phương thức/hóa đơn
trống; kiểm tra responsive 320/375/1280px và không có lỗi runtime/mã giao dịch nhạy cảm.
Ảnh/báo cáo ở `.next/checkout-review-check`. Fixture không dùng Supabase chung.
Các script shopping/manual/customer-review đã cập nhật theo trang xác nhận mới.
15 nhóm shopping E2E và 5 kiểm tra manual fixture đã đạt với luồng xác nhận mới.

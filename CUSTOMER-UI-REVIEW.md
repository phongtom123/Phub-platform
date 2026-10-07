# Sửa bộ lọc, xem nhanh và chọn sản phẩm trong giỏ

Thực hiện trên nhánh `ui-review`, ngày 06/10/2026. UI khách hàng hiện có dùng
API/backend và Supabase thật. Đợt này không sửa cấu trúc database, đăng nhập,
admin hoặc nghiệp vụ xuất kho; không thêm/sửa/xóa dữ liệu Supabase.

## Bộ lọc catalog

- Khoảng giá có **Giá từ (₫)** và **Giá đến (₫)**, để trống để bỏ giới hạn.
  Giá trước thuế, bao gồm hai đầu khoảng; giá âm, không hợp lệ hoặc khoảng đảo
  trả lỗi validation nhất quán. Các bộ lọc kết hợp trước khi tính tổng/phân trang.
- Màu sắc đọc `SAN_PHAM.thong_so_ky_thuat`. Ví dụ nội dung đã khai báo
  `Màu sắc: Đen` hoặc JSON `{"Màu sắc":"Đen","RAM":"16 GB"}` có thể lọc màu Đen.
  Không suy đoán màu từ tên/ảnh. Chưa khai báo màu được xếp vào **Chưa có thông tin màu sắc**.
- Tồn kho có **Tất cả trạng thái**, **Còn hàng**, **Hết hàng**. API tính tồn
  khả dụng từng kho hoạt động sau khi trừ lượng giữ bởi đơn chưa xuất kho;
  không công khai số lượng hoặc thông tin đơn đang giữ hàng.
- Desktop/mobile dùng chung các trường lọc, lưu URL khi áp dụng, giữ điều kiện
  sau reload và đưa về trang 1 khi đổi bộ lọc.

API thêm `GET /api/catalog/colors` và các query `min_price`, `max_price`, `color`,
`stock_status` của `GET /api/catalog/products`; Swagger đã cập nhật.
Giá được lọc tại database; màu/tồn được tính bằng đọc theo lô các sản phẩm phù hợp
trước khi phân trang. Cách này giữ nguyên schema nhưng chi phí đọc tăng theo số
sản phẩm/đơn đang giữ hàng; catalog lớn cần tối ưu truy vấn cùng nhóm database.
Code backend: `app/catalog/schemas.py`, `repository.py`, `availability.py`, `router.py`.
Frontend: `CatalogFilterFields`, sidebar/mobile filters, `useCatalog`, catalog client/types và proxy.

Tại thời điểm kiểm tra database có 33 sản phẩm, đều còn hàng và chưa khai báo
màu sắc. Vì vậy nhóm thiếu màu và danh sách Hết hàng trống là kết quả dữ liệu thật.
Các trường hợp nhiều màu, hết hàng và hàng giữ được kiểm tra bằng fixtures riêng.

## Xem nhanh sản phẩm

Trang chủ và catalog đều dùng `ProductPreviewActions`: **Xem chi tiết sản phẩm**
mở đúng `ma_sp`; **Thêm vào giỏ hàng** tải lại sản phẩm từ API và thêm vào giỏ chung.
Đã bỏ nút Tiếp tục xem sản phẩm. Thay đổi ở `HomeDialog`, `CatalogPreview` và
`AddToCartButton`; giữ component đăng nhập của thành viên khác.

## Giỏ hàng và checkout

Mỗi dòng có ô chọn tròn bên trái. Hai nút cuối danh sách là **Chọn tất cả** bên
trái và **Thanh toán** bên phải; đã bỏ Tiếp tục mua sắm, Xóa giỏ hàng và Cập nhật sản phẩm.
Vẫn có nút xóa từng dòng và sửa số lượng.

`ShoppingProvider` lưu `selected` theo khách trong localStorage, cùng mã sản phẩm,
SKU và số lượng. Sản phẩm mới/giỏ cũ được chọn mặc định. Chọn tất cả chọn mọi dòng;
bấm từng ô để bỏ/chọn riêng, reload giữ lựa chọn. Không chọn dòng nào thì không
cho thanh toán. Header vẫn đếm mọi sản phẩm trong giỏ.

`useCheckoutQuote` chỉ gửi dòng được chọn; voucher và tổng báo giá cũng chỉ áp dụng
cho những dòng này. `CheckoutProcess` gửi đúng báo giá đã xác nhận. Retry một
lần đặt chưa rõ kết quả giữ nguyên UUID/body cũ. `completeOrder` chỉ trừ những SKU
đã đặt thành công, giữ sản phẩm không được chọn trong giỏ.

## Tự kiểm tra

Chạy chế độ SupabaseTest theo [CUSTOMER-SUPABASE-TESTING.md](CUSTOMER-SUPABASE-TESTING.md),
mở http://127.0.0.1:3001/; Swagger http://127.0.0.1:8001/docs.

1. Catalog: nhập khoảng giá, chọn màu/trạng thái, áp dụng; thử kết hợp, xóa lọc,
   đổi trang và reload. Mobile mở **Lọc** rồi chọn mục cần thay đổi.
2. Trang chủ/catalog: mở xem nhanh, thử hai nút mới.
3. Thêm hai sản phẩm, mở giỏ; bỏ chọn một sản phẩm rồi reload, thử Chọn tất cả.
   Bỏ chọn tất cả để kiểm tra nút Thanh toán bị khóa; chọn lại rồi chuyển checkout.

Supabase chung còn thiếu RPC checkout: báo giá/voucher/tạo đơn trả
`503 CHECKOUT_DATABASE_NOT_READY`. Đợt sửa UI này không cài migration hoặc giả báo
đặt thành công. Luồng tạo đơn hoàn chỉnh được kiểm thử bằng backend fixture riêng.

Kiểm thử backend: toàn suite 332 tests đạt, gồm 19 tests mới về bộ lọc. Kiểm thử
Chrome `scripts/check-customer-review.mjs` đạt 4 nhóm: bộ lọc kết hợp, hai nút xem
nhanh, lựa chọn/checkout đúng SKU và bố cục 320/375/1280px; không ghi database.
Báo cáo/ảnh nằm trong `.next/customer-review-check`. Các script E2E mua hàng cũ
đã được cập nhật để thao tác nút Thanh toán mới: 15 nhóm shopping E2E và 5
kiểm tra UI fixture đạt. Build production Webpack/TypeScript đạt.
27 kiểm tra catalog cũ cũng đạt: tìm kiếm, sắp xếp, phân trang, Back/Forward,
metadata lỗi, chi tiết và responsive; báo cáo trong `.next/catalog-check`.

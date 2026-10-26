# UI khách hàng: desktop và mobile

Source đang sử dụng: `ui/userUI/Frontend`. Thư mục `Frontend/` ở root chỉ
còn các file sinh tự động từ lần chạy cũ, không phải ứng dụng để deploy.

## Quy ước

- Header trắng, logo, icon và màu nhấn theo desktop. Điện thoại mở danh mục
  bằng hamburger với ngăn kéo hai cấp `MobileCategoryDrawer` như bản cũ;
  có quay lại, đóng và nền tối. Desktop tiếp tục dùng `MegaMenu`.
  Giỏ hàng/tài khoản mở bằng chạm, desktop hỗ trợ hover và click.
- Hai kích thước dùng cùng `AccountMenu`, `CartPreview`,
  `CatalogPage` và `DesktopProductDetail`. Không dùng bộ dữ liệu mobile riêng.
- Trang chủ dùng cùng ảnh banner, ảnh sản phẩm, logo thương hiệu và hộp xem
  nhanh. Các hàng sản phẩm có thể cuộn ngang trên màn hình nhỏ.
- Catalog giữ cả dạng lưới/danh sách, sắp xếp, phân trang và bộ lọc.
  Bộ lọc thu gọn dưới 800px; header thu danh mục dưới 1100px.
- Trang chi tiết đưa ảnh lên trước nội dung trên điện thoại; tên/giá/ảnh lấy
  từ sản phẩm đang mở. Footer thu gọn thành accordion nhưng giữ nguyên link.
- Ngoài menu ngăn kéo, các component Figma mobile cũ được giữ để tham khảo, không dùng để thay
  nội dung route khi viewport thay đổi. Giao diện vẫn dùng dữ liệu demo;
  giỏ hàng xem nhanh trên header chưa kết nối giỏ hàng thật/backend.

## Kiểm tra giống môi trường triển khai

Chạy trong `ui/userUI/Frontend`:

```sh
npm ci
npm run build
npm run start
```

Kiểm tra `/`, `/main/product`, `/main/product?view=list`,
`/main/product/ps-001`, `/cart`, `/contact-us` ở 320, 375, 390, 760, 768,
1024 và 1440 CSS px. Thử mở/đóng menu, giỏ hàng, tài khoản, xem nhanh,
lọc và đổi kích thước khi các bảng đang mở. Đối chiếu thêm với `npm run dev`.

## Render

- Root Directory: `ui/userUI/Frontend`.
- Build Command: `npm ci && npm run build`.
- Start Command: `npm run start -- --hostname 0.0.0.0 --port $PORT`.
- Deploy cùng nhánh và commit với source đã kiểm tra ở local.

Ngày 2026-10-01, HTML lấy từ `https://phub-platform.onrender.com` không có
`MobileHeader`, có giỏ hàng xem nhanh trống. Source local trước sửa lại có
header mobile xanh, badge 2 và liên kết trực tiếp đến `/cart`. Đây là khác
biệt phiên bản code, không phải bằng chứng CSS desktop ghi đè CSS mobile.

## Kết quả kiểm tra sau sửa (2026-10-01)

- `npm run build` và `npm run lint`: thành công.
- Chrome production: 6 route (`/`, catalog grid/list, chi tiết `ps-001`,
  giỏ hàng, liên hệ) ở 11 chiều rộng: 320, 375, 390, 540, 760, 768, 900,
  1024, 1100, 1280, 1440px. Cả 66 tổ hợp không tràn ngang toàn trang.
  Các hàng sản phẩm vẫn cuộn ngang trong vùng riêng theo thiết kế.
- Kiểm tra chạm ở 390px và click ở 1440px: giỏ hàng, tài khoản, tìm kiếm,
  danh mục, đóng bằng Escape, xem nhanh, xóa bộ lọc, đổi dạng danh sách và
  sắp xếp. Xem nhanh/bộ lọc giữ trạng thái khi resize; không có lỗi JS.
- Đối chiếu computed styles của header, thanh công cụ, card và ảnh sản phẩm
  trên trang chủ 390px: dev và production giống nhau khi giả lập dark mode.
- Đã sửa thêm breakpoint giỏ hàng bị tràn ngang tại 768px.

Các kiểm tra này chạy trên source local; chưa triển khai thay đổi lên Render.

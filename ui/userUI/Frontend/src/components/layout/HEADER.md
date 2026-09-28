# PHUB Store header

Header dùng chung cho giao diện khách hàng, chỉ hiển thị các nhóm hàng PC nguyên bộ, màn hình và linh kiện máy tính. PHUB Store không kinh doanh laptop.

## Cấu trúc

- `header.tsx`: thanh thông tin, điều hướng danh mục, tìm kiếm, giỏ hàng, tài khoản và menu mobile.
- `HeaderPanels.tsx`: giờ mở cửa, menu khách và phần xem nhanh giỏ hàng.
- `headerData.ts`: nhãn và URL của các danh mục sản phẩm.
- `Header.module.css`: giao diện responsive và animation của header.

Logo dẫn về `/main/landing`. Các danh mục dẫn đến `/main/product` cùng tham số lọc tương ứng. Menu tài khoản dẫn đến trang đăng nhập hoặc đăng ký.

Giỏ hàng, tìm kiếm và thanh toán hiện vẫn là giao diện tĩnh; dữ liệu và thao tác thật sẽ được nối với API sau.

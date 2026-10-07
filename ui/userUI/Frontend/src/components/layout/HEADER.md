# Tech Store header — UI only

> Cập nhật responsive: header hiện dùng một cây `AltHeader` cho desktop/mobile.
> Mobile giữ nền trắng, logo/icon, giỏ hàng xem nhanh và menu tài khoản của
> desktop; hamburger mở lại `MobileCategoryDrawer` hai cấp theo bản cũ,
> còn desktop tiếp tục dùng `MegaMenu`.
> `MobileHeader` và `Account1` bên dưới là bản Figma
> tham khảo, không còn được render. Xem `../../../RESPONSIVE.md`.

Header hiện dùng bố cục và nội dung của `C:/xampp/htdocs/web2/user/compin.php`, kèm tham chiếu `asset/css/user/compin.css` và `asset/js/user/compin.js`. Không sửa dự án PHP.

## Cấu trúc

- `AltHeader.tsx`: header dùng chung, quản lý thanh thông tin, danh mục desktop, tìm kiếm, dropdown và drawer mobile (Figma `174:7227`).
- `components/mobile/header/MobileHeader.tsx`: thanh công cụ mobile; trang danh mục dùng biến thể gọn một hàng theo Home Page 2.
- `components/mobile/menu/Menu1.tsx`, `Menu2.tsx`, `MobileCategoryDrawer.tsx`: hai cấp danh mục trong cùng một drawer; dữ liệu tách ở `menuData.ts`.
- `HeaderPanels.tsx`: giờ mở cửa, menu khách và giỏ hàng rỗng.
- `headerData.ts`: danh mục và nhãn tài khoản.
- `common/SearchInput.tsx`, `Button.tsx`, `icon.tsx`: các thành phần dùng chung.
- `Header.module.css`: CSS được giới hạn trong header, không ảnh hưởng footer.

Logo dùng `public/images/1.png` đã có trong dự án, giống logo của file PHP. Các icon SVG dùng lại từ bộ header hiện có; avatar khách không dùng ảnh người mẫu.

## Animation và tương tác

- Dropdown chuyển opacity/translateY trong 160ms; giữ DOM để có cả hiệu ứng mở và đóng.
- Dropdown ẩn có `inert` và `aria-hidden`: không nhận tab/click hoặc bị trình đọc màn hình đọc nhầm.
- Ô tìm kiếm dùng opacity/scaleX trong 180ms khi mở; đóng tức thì.
- Mũi tên giờ mở cửa và hamburger dùng transform trong 180ms.
- Desktop hỗ trợ hover; bấm nút ghim dropdown mở. Bấm lại, Escape hoặc bấm ra ngoài để đóng.
- Mobile dùng nút bấm; hamburger mở Menu 1, chọn danh mục mở Menu 2, chọn mục con điều hướng đến Home Page 2.
- `prefers-reduced-motion: reduce` tắt toàn bộ animation/transition của header.
- Không thêm thư viện animation, không chạy vòng lặp JS, không dùng z-index cực lớn như bản PHP.

## Phạm vi hiện tại

### Mega menu mẫu

Trên desktop, rê chuột hoặc bấm **Laptops** để xem 4 sản phẩm mẫu và 7 thương hiệu. Chọn **Everyday Use Notebooks → MSI Workstation Series → MSI WS Series** để xem menu 3 cột. Nút **Tất cả laptop** trở về bố cục 4 sản phẩm. Trên mobile, hamburger mở Menu 1 → Menu 2 và điều hướng đến Home Page 2.

`MegaMenu.tsx` tái sử dụng `ProductCard` và `BrandTile`; dữ liệu tách trong `megaMenuData.ts`. Bốn cấu hình/giá dùng cùng ảnh MSI Pro 16 hiện có, chỉ là minh họa. Logo thương hiệu được sao chép nguyên bản từ asset PHP. Bấm sản phẩm chỉ cập nhật mô tả trong menu, không điều hướng hoặc thêm vào giỏ.

Các trạng thái mobile Menu 1 và Menu 2 được đối chiếu với Figma `642:11407` và `642:11408`. Danh mục PC cấp hai theo thiết kế; các nhánh khác là dữ liệu mẫu trong `menuData.ts`.

Chỉ UI theo yêu cầu. Chưa có tìm kiếm AJAX, SQL, session, đăng nhập, đồng bộ giỏ hàng hoặc thanh toán. Không gọi API PHP.

Ngoài mega menu Laptops trên desktop, các danh mục desktop còn lại, tài khoản và form tìm kiếm hiện thông báo UI demo thay vì đi đến các trang Next.js còn trống. Các mục trong drawer mobile có liên kết đến Home Page 2 với tiêu đề danh mục được chọn. Badge giỏ hàng là 0 và nút thanh toán bị vô hiệu hóa khi giỏ trống. Logo, số điện thoại, email và liên hệ footer là liên kết thật; mạng xã hội chỉ là icon vì chưa có URL.

Khi triển khai nghiệp vụ, truyền dữ liệu user/cart, gắn các URL đã hoàn thiện và nối form tìm kiếm với API. Không đưa logic SQL hoặc thông tin kết nối database vào component trình duyệt.

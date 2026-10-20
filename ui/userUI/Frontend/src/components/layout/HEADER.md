# Tech Store header — UI only

> Cập nhật responsive: header hiện dùng một cây `AltHeader` cho desktop/mobile.
> Mobile giữ nền trắng, logo/icon, giỏ hàng xem nhanh và menu tài khoản của
> desktop; hamburger mở `MobileCategoryDrawer` với cây danh mục cha–con từ API,
> desktop hiển thị mega menu gồm danh mục con, sản phẩm và thương hiệu thật.
> `MobileHeader` và `Account1` bên dưới là bản Figma
> tham khảo, không còn được render. Xem `../../../RESPONSIVE.md`.

Header hiện dùng bố cục và nội dung của `C:/xampp/htdocs/web2/user/compin.php`, kèm tham chiếu `asset/css/user/compin.css` và `asset/js/user/compin.js`. Không sửa dự án PHP.

## Cấu trúc

- `AltHeader.tsx`: header dùng chung, quản lý thanh thông tin, danh mục desktop, tìm kiếm, dropdown và drawer mobile (Figma `174:7227`).
- `components/mobile/header/MobileHeader.tsx`: thanh công cụ mobile; trang danh mục dùng biến thể gọn một hàng theo Home Page 2.
- `CatalogMegaMenu.tsx`: menu desktop tải lười sản phẩm theo danh mục cha đang mở.
- `MobileCategoryDrawer.tsx`: cây danh mục cha–con từ API; `Menu1.tsx`, `Menu2.tsx` và `menuData.ts` chỉ là bản Figma cũ để tham khảo.
- `HeaderPanels.tsx`: giờ mở cửa, menu khách và giỏ hàng rỗng.
- `headerData.ts`: danh mục và nhãn tài khoản.
- `common/SearchInput.tsx`, `Button.tsx`, `icon.tsx`: các thành phần dùng chung.
- `Header.module.css`: CSS được giới hạn trong header, không ảnh hưởng footer.

Logo dùng `media/products/1.png` trong Supabase Storage, giống logo của file PHP. Các icon SVG dùng lại từ bộ header hiện có; avatar khách không dùng ảnh người mẫu. Xem `MEDIA_STORAGE.md` để biết ánh xạ URL.

## Animation và tương tác

- Dropdown chuyển opacity/translateY trong 160ms; giữ DOM để có cả hiệu ứng mở và đóng.
- Dropdown ẩn có `inert` và `aria-hidden`: không nhận tab/click hoặc bị trình đọc màn hình đọc nhầm.
- Ô tìm kiếm dùng opacity/scaleX trong 180ms khi mở; đóng tức thì.
- Mũi tên giờ mở cửa và hamburger dùng transform trong 180ms.
- Desktop hỗ trợ hover; bấm nút ghim dropdown mở. Bấm lại, Escape hoặc bấm ra ngoài để đóng.
- Mobile dùng nút bấm; hamburger mở danh sách loại, chọn một loại sẽ mở catalog theo mã loại.
- `prefers-reduced-motion: reduce` tắt toàn bộ animation/transition của header.
- Không thêm thư viện animation, không chạy vòng lặp JS, không dùng z-index cực lớn như bản PHP.

## Phạm vi hiện tại

### Mega menu catalog

Trên desktop, rê chuột hoặc focus một danh mục cha để mở mega menu. Cột trái
hiển thị danh mục con; phần chính lấy tối đa 4 sản phẩm nổi bật; hàng cuối lấy
thương hiệu từ chính các sản phẩm API. Menu chỉ gọi API khi được mở và có trạng
thái loading, empty, error và retry. Mobile tiếp tục dùng drawer cha–con gọn hơn.

Mega menu và drawer đều điều hướng về catalog bằng `category_id` hoặc
`subcategory_id`. Tìm kiếm và session dùng API Next.js/FastAPI hiện tại; không gọi API PHP.
Badge giỏ hàng vẫn là 0 và nút thanh toán bị vô hiệu hóa khi giỏ trống.

Khi triển khai nghiệp vụ, truyền dữ liệu user/cart, gắn các URL đã hoàn thiện và nối form tìm kiếm với API. Không đưa logic SQL hoặc thông tin kết nối database vào component trình duyệt.

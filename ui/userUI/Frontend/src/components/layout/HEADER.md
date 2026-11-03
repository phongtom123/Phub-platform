# Tech Store header — UI only

> Cập nhật responsive: header hiện dùng một cây `AltHeader` cho desktop/mobile.
> Mobile giữ nền trắng, logo/icon, giỏ hàng xem nhanh và menu tài khoản của
> desktop; hamburger mở `MobileCategoryDrawer` với cây danh mục cha–con từ API,
> desktop hiển thị hai khung: danh mục cha bên trái và các nhóm lựa chọn bên phải.
> `MobileHeader` và `Account1` bên dưới là bản Figma
> tham khảo, không còn được render. Xem `../../../RESPONSIVE.md`.

Header hiện dùng bố cục và nội dung của `C:/xampp/htdocs/web2/user/compin.php`, kèm tham chiếu `asset/css/user/compin.css` và `asset/js/user/compin.js`. Không sửa dự án PHP.

## Cấu trúc

- `AltHeader.tsx`: header dùng chung; nút Danh mục mở dropdown desktop hoặc drawer mobile. Thanh thông tin giờ mở cửa/địa chỉ/hotline phía trên đã được bỏ.
- `HeaderSearch.tsx`: tìm kiếm luôn hiển thị, nút Tìm kiếm nằm trong ô, nút Bộ lọc cạnh ô tìm kiếm; giữ từ khóa/bộ lọc theo URL và gợi ý sản phẩm thật.
- `components/mobile/header/MobileHeader.tsx`: thanh công cụ mobile; trang danh mục dùng biến thể gọn một hàng theo Home Page 2.
- `CatalogMegaMenu.tsx` và CSS cùng tên: các ô chọn loại, thương hiệu, mức giá và thông số từ facets của danh mục cha; ảnh lấy từ sản phẩm thật, thiếu ảnh dùng icon.
- `MobileCategoryDrawer.tsx`: cây danh mục cha–con từ API; `Menu1.tsx`, `Menu2.tsx` và `menuData.ts` chỉ là bản Figma cũ để tham khảo.
- `HeaderPanels.tsx`: giờ mở cửa, menu khách và giỏ hàng rỗng.
- `headerData.ts`: danh mục và nhãn tài khoản.
- `common/SearchInput.tsx`, `Button.tsx`, `icon.tsx`: các thành phần dùng chung.
- `Header.module.css`: CSS được giới hạn trong header, không ảnh hưởng footer.

Logo dùng `media/products/1.png` trong Supabase Storage, giống logo của file PHP. Các icon SVG dùng lại từ bộ header hiện có; avatar khách không dùng ảnh người mẫu. Xem `MEDIA_STORAGE.md` để biết ánh xạ URL.

## Animation và tương tác

- Menu tài khoản/giỏ hàng chuyển opacity/translateY trong 160ms; giữ DOM để có cả hiệu ứng mở và đóng.
- Menu tài khoản/giỏ hàng ẩn có `inert` và `aria-hidden`: không nhận tab/click hoặc bị trình đọc màn hình đọc nhầm.
- Ô tìm kiếm luôn hiển thị; menu danh mục chỉ mount khi mở và khóa cuộn nền đến khi đóng.
- Hamburger dùng transform trong 180ms.
- Desktop hỗ trợ hover; bấm nút ghim dropdown mở. Bấm lại, Escape hoặc bấm ra ngoài để đóng.
- Mobile dùng nút bấm; hamburger mở danh sách loại, chọn một loại sẽ mở catalog theo mã loại.
- `prefers-reduced-motion: reduce` tắt toàn bộ animation/transition của header.
- Không thêm thư viện animation, không chạy vòng lặp JS, không dùng z-index cực lớn như bản PHP.

## Phạm vi hiện tại

### Mega menu catalog

Trên desktop, bấm Danh mục để mở hai khung cùng nền tối. Rê chuột hoặc focus
danh mục bên trái để đổi nội dung bên phải. Các ô chọn thương hiệu và thông số
lấy từ `/api/catalog/facets` theo danh mục đang mở; mức giá là các khoảng định
sẵn. Link giữ `category_id` và thêm điều kiện tương ứng; loại con giữ cả mã cha
và con. Không tải toàn bộ catalog để làm nóng menu. Ảnh minh họa lấy tối đa 20
sản phẩm của danh mục, không dùng mẫu này để suy ra lựa chọn lọc. Facets tái dùng
cache RAM có giới hạn của catalog. Có loading, empty, error và retry; Escape,
bấm nền tối hoặc tìm kiếm đóng menu. Mobile tiếp tục dùng drawer cha–con.

Mega menu và drawer đều điều hướng về catalog bằng `category_id` hoặc
`subcategory_id`. Tìm kiếm và session dùng API Next.js/FastAPI hiện tại; không gọi API PHP.
Badge giỏ hàng vẫn là 0 và nút thanh toán bị vô hiệu hóa khi giỏ trống.

Khi triển khai nghiệp vụ, truyền dữ liệu user/cart, gắn các URL đã hoàn thiện và nối form tìm kiếm với API. Không đưa logic SQL hoặc thông tin kết nối database vào component trình duyệt.

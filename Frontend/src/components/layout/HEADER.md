# Tech Store header — UI only

Header hiện dùng bố cục và nội dung của `C:/xampp/htdocs/web2/user/compin.php`, kèm tham chiếu `asset/css/user/compin.css` và `asset/js/user/compin.js`. Không sửa dự án PHP.

## Cấu trúc

- `header.tsx`: thanh thông tin, 5 danh mục, đóng/mở tìm kiếm, dropdown và menu mobile.
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
- Mobile dùng nút bấm; dưới 1100px có menu danh mục gọn và tìm kiếm ở hàng thứ hai.
- `prefers-reduced-motion: reduce` tắt toàn bộ animation/transition của header.
- Không thêm thư viện animation, không chạy vòng lặp JS, không dùng z-index cực lớn như bản PHP.

## Phạm vi hiện tại

Chỉ UI theo yêu cầu. Chưa có tìm kiếm AJAX, SQL, session, đăng nhập, đồng bộ giỏ hàng hoặc thanh toán. Không gọi API PHP.

Danh mục, tài khoản và form tìm kiếm hiện thông báo UI demo thay vì đi đến các trang Next.js còn trống. Badge giỏ hàng là 0 và nút thanh toán bị vô hiệu hóa khi giỏ trống. Logo, số điện thoại, email và liên hệ footer là liên kết thật; mạng xã hội chỉ là icon vì chưa có URL.

Khi triển khai nghiệp vụ, truyền dữ liệu user/cart, gắn các URL đã hoàn thiện và nối form tìm kiếm với API. Không đưa logic SQL hoặc thông tin kết nối database vào component trình duyệt.

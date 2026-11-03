# Chi tiết sản phẩm

- `page.tsx` đọc sản phẩm thật từ API; `ResponsiveProductDetail` chọn bố cục.
- Desktop/mobile đều hiển thị mô tả và thông số cùng một trang, qua component
  dùng chung `components/catalog/ProductInformation.tsx`.
- Mô tả xem trước 240px, bảng thông số 440px. ResizeObserver đo nội dung thực;
  chỉ hiện nút Xem thêm/Thu gọn khi nội dung tràn. Hai phần mở độc lập bằng state
  local, không điều hướng, gọi lại API hay ghi dữ liệu.
- URL cũ `?tab=about|details|specs` vẫn mở trang đầy đủ; không chia nội dung theo tab.
- Phần giới thiệu đầu trang chỉ là tóm tắt; nội dung đầy đủ nằm dưới ảnh/nút mua.
- Dòng dưới mô tả hiển thị tồn khả dụng thay SKU, cỡ chữ 16px và số lượng 19px.
  Desktop/mobile dùng chung kết quả tồn với ô số lượng/nút mua, không gọi thêm API
  riêng cho dòng này. Lỗi tải không hiển thị số 0; tạm ngừng có thông báo riêng.
- `ProductDetailActions` vẫn xử lý số lượng, tồn khả dụng, thêm giỏ và Mua ngay.
- Ô số lượng giới hạn ngay khi nhập bằng tổng tồn khả dụng trừ số đang có trong
  giỏ. Nút “+” dừng ở mức này; chuỗi trống vẫn được giữ khi đang sửa. Hook dùng
  API availability hiện có và không gọi lại API theo từng phím. Khi tồn thay đổi,
  giá trị nháp cũng được giới hạn lại; lỗi API chặn mua và cho thử lại.

Kiểm tra: `tests/product-information.e2e.cjs` (desktop/mobile; văn bản dài là
fixture trong DOM trình duyệt), `tests/product-stock.e2e.cjs`, TypeScript và lint.

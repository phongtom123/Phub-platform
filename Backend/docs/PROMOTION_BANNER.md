# Banner chương trình khuyến mãi

## Hiển thị trên trang chủ khách hàng

Ô quảng cáo đầu trang `/main/landing` lấy ảnh qua `GET /api/catalog/banners`.
API chỉ trả chương trình `HOAT_DONG`, đã đến ngày bắt đầu, chưa qua ngày kết thúc,
có `ma_media_banner` liên kết MEDIA và URL ảnh hợp lệ. Thời gian khớp cấu hình
`CHECKOUT_PROMOTION_TIMEZONE` (mặc định giờ Việt Nam); chỉ trả thông tin công khai
gồm mã, tên, URL, mô tả ảnh và kích thước.

Để đổi ảnh: **Admin → Khuyến mãi → chọn chương trình → Chỉnh sửa → Hình ảnh
banner → chọn/kéo thả ảnh → Lưu dữ liệu**. Kiểm tra trạng thái và thời hạn chương
trình. Không cần nhập lại URL trên giao diện khách. Trang chủ đọc lại khi quay
lại tab và mỗi phút lúc trang đang hiển thị. Nhiều banner có nút trước/sau và nút
chọn; một banner không hiện nút chuyển. Không có chương trình phù hợp thì ẩn ô,
không dùng ảnh giả lập. Bấm ảnh mở danh sách sản phẩm. Chưa có cột URL đích trong
schema nên không tự lưu liên kết quảng cáo riêng.

Chức năng này dùng nguyên bảng và liên kết hiện có, không cần migration mới.
Chỉ đọc metadata banner trên trang khách; upload và cập nhật vẫn yêu cầu ADMIN.

Mỗi chương trình có **tối đa một banner**, được lưu qua cột UUID nullable
`CHUONG_TRINH_KHUYEN_MAI.ma_media_banner` tham chiếu `MEDIA.ma_media`.
Chương trình cũ không có banner vẫn hoạt động bình thường.

## Triển khai

1. Áp dụng `Backend/migrations/20261029071036_promotion_banner.sql` vào đúng Supabase project.
2. Deploy backend mới, rồi deploy admin UI. Metadata `/api/data/resources` phải có `ma_media_banner` trong `promotions`.
3. Nếu admin vẫn dùng metadata cache cũ, bấm **Làm mới** ở danh sách khuyến mãi hoặc đăng nhập lại.

Migration chỉ bổ sung cột, khóa ngoại và index; không sửa dữ liệu chương trình hiện tại.
Khóa ngoại dùng `ON DELETE SET NULL`: xóa bản ghi MEDIA không xóa chương trình.
Giữ nguyên RLS và quyền service_role hiện có; browser không đọc/ghi Supabase trực tiếp.

## API (ADMIN)

- `POST /api/admin/media/images?purpose=promotion_banner`: gửi binary JPG/PNG/WebP với Content-Type tương ứng; tối đa 5 MB, 4096 × 4096, ảnh tĩnh. Backend chuẩn hóa WebP, bỏ EXIF, lưu vào `media/promotions/` (hoặc bucket đã cấu hình) và đăng ký MEDIA.
- `GET /api/admin/media/images/{media_id}`: trả `media_id`, `url`, `width`, `height` để xem trước ảnh.
- `POST /api/data/promotions`: gửi thông tin chương trình và `ma_media_banner` tùy chọn.
- `PATCH /api/data/promotions?key=[123]`: gửi `{"ma_media_banner":"<UUID đã upload>"}` để thay; gửi `{"ma_media_banner":null}` để gỡ. Trường này không nhận mảng.

Các API ghi vẫn yêu cầu xác thực ADMIN và Origin hợp lệ như trước. Thư mục upload được chọn từ enum cố định, không nhận đường dẫn tùy ý.

## Admin UI

Trong form tạo/chỉnh sửa chương trình: chọn hoặc kéo thả **một** ảnh, xem trước,
thay/gỡ banner rồi bấm **Lưu dữ liệu**. File chỉ tải lên lúc lưu.
Nếu upload thành công nhưng lưu chương trình thất bại, thử lưu lại sẽ dùng MEDIA
đã đăng ký, không upload trùng. Nếu rời trang ở thời điểm đó, file có thể chưa
được liên kết; không tự xóa file để tránh mất dữ liệu.

Trang chi tiết có banner ngang, giữ tỉ lệ ảnh bằng `object-fit: contain` và
xem ảnh gốc trong hộp thoại cùng tab. Gợi ý tỉ lệ 16:5, không bắt buộc crop.
Thay/gỡ banner chỉ đổi liên kết; **không xóa file trên Storage**.
Danh sách và chỉnh sửa inline không hiển thị UUID nội bộ.

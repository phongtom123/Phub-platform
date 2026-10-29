# Banner chương trình khuyến mãi

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

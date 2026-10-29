# Gallery sản phẩm trong admin

## Phạm vi

- Form thêm/sửa sản phẩm hỗ trợ chọn/kéo thả nhiều ảnh; tối đa 20 ảnh/sản phẩm.
- JPG, PNG, WebP tĩnh, tối đa 5 MB và 4096 × 4096 pixel/ảnh; backend chuẩn hóa WebP.
- Ảnh đầu tiên là ảnh chính. Có nút chọn ảnh chính, chuyển trước/sau, gỡ từng ảnh và thêm URL.
- Trang chi tiết hiển thị gallery và mở ảnh lớn bằng dialog trong cùng tab.
- Chưa bổ sung quản lý avatar cho các màn hình admin.

## Triển khai

1. Database phải có `MEDIA`, FK `MEDIA_product_fkey` và trigger `SAN_PHAM_sync_primary_media` từ migration shared media.
2. Chạy `Backend/migrations/20261029062340_product_gallery.sql` trên database cần triển khai. **Không chạy lại initial_schema hoặc shared_media trên database đã có bảng.**
3. Deploy backend, sau đó frontend admin. Lỗi 503 khi lưu gallery có thể do thiếu RPC; GET có thể hoạt động dù RPC chưa được cài.

Migration chỉ thêm RPC, không thêm bảng, không xóa dữ liệu hoặc file Storage. Chưa tự chạy trên database thật.

## API

- `POST /api/admin/media/images`: upload một file nhị phân, trả `media_id` và `url`. UI upload lần lượt nhiều file.
- `GET /api/admin/media/products/{product_id}/images`: `{product_id, legacy_url, images: [{media_id,url,alt_text,position,primary}]}`.
- `PUT /api/admin/media/products/{product_id}/images`: thay toàn bộ danh sách liên kết trong một transaction.

```json
{
  "items": [
    {"media_id": "00000000-0000-0000-0000-000000000001"},
    {"url": "https://example.com/another-image.webp"}
  ],
  "expected_ids": ["00000000-0000-0000-0000-000000000001"],
  "expected_legacy_url": "/images/old.png"
}
```

`expected_ids` là danh sách ID theo đúng thứ tự GET trả về, `expected_legacy_url` là giá trị GET tương ứng. Nếu một tác nhân khác đổi gallery hoặc URL cũ trước khi lưu, API trả 409; dùng **Tải lại gallery** để lấy trạng thái mới trước khi sửa lại.

API chỉ dành cho ADMIN; PUT kiểm tra Origin. RPC chỉ cấp EXECUTE cho service_role, dùng SECURITY INVOKER và search_path rỗng. Không cho chuyển ảnh từ sản phẩm khác hoặc sử dụng ảnh đang là avatar. URL ngoài chỉ được lưu dưới dạng liên kết, backend không fetch URL đó.

## Tương thích và lỗi từng phần

- Đồng bộ ảnh chính về `SAN_PHAM.duong_dan_anh` cho UI/consumer cũ; catalog hiện tại tiếp tục đọc nhiều ảnh từ `MEDIA.ma_sp`.
- Gỡ ảnh chỉ đặt các trường liên kết về NULL/false; giữ metadata và file để có thể phục hồi. API này không xóa Storage.
- Upload Storage nằm ngoài transaction DB. Nếu upload/sửa gallery lỗi, các file đã upload có thể còn chưa gắn sản phẩm; retry trong cùng form tái sử dụng `media_id`, không upload lại những file đã thành công.
- Thông tin sản phẩm và gallery là hai lần lưu riêng. Nếu thông tin đã lưu nhưng gallery lỗi, UI thông báo rõ và giữ khóa sản phẩm để retry không tạo trùng sản phẩm.

## Kiểm thử offline

```powershell
cd Backend
.venv\Scripts\python.exe -m pytest tests/test_product_gallery.py tests/test_media.py tests/test_openapi.py -q
cd ..
node --test ui/adminUI/tests/product-gallery.test.cjs ui/shared/tests/backend-route.test.cjs
node Backend/tests/product-gallery-sql.test.cjs
node ui/adminUI/tests/product-gallery.e2e.cjs
```

Hai script cuối cần `@electric-sql/pglite` và Playwright/Chromium. Có thể đặt `PHUB_PGLITE_MODULE`, `PHUB_PLAYWRIGHT_MODULE`, `PHUB_CHROMIUM_EXECUTABLE` tới bộ công cụ kiểm thử riêng. Browser test chặn toàn bộ API, không ghi database thật.

# Supabase media storage

Toàn bộ media tĩnh của frontend được lưu trong Supabase Storage. Thư mục
`public/` không còn là nơi lưu bản gốc của các file này.

## Vị trí hiện tại

| Mục | Giá trị |
| --- | --- |
| Supabase project | `Phub` (`btfhahnjydaiivvcqnna`) |
| Bucket | `media` |
| Chế độ đọc | Public |
| Ảnh để warehouse chọn | `products/` |
| Icon và asset hệ thống | `site/icons/` và `site/<tên-file>` |
| URL gốc của ảnh | `https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products` |
| Ngày cập nhật | 2026-10-17 |

Đợt chuyển mới nhất đã đưa 111 ảnh, tổng cộng 5.169.286 byte, từ
`media/site/images/` sang `media/products/`. Hai ảnh sản phẩm do warehouse tải
lên trước đó được giữ nguyên. Hiện `products/` có 113 object.

## Ánh xạ đường dẫn

| Đường dẫn cũ | Object trong bucket | URL dùng trong code |
| --- | --- | --- |
| `public/images/...` | `media/products/...` | `/images/...` |
| `public/icons/...` | `media/site/icons/...` | `/icons/...` |
| `src/app/favicon.ico` | `media/site/favicon.ico` | `/favicon.ico` |
| Các SVG ở gốc `public/` | `media/site/<tên-file>` | `/<tên-file>` |

Các URL ngắn vẫn hoạt động nhờ `rewrites()` trong `next.config.ts`. Ví dụ:

```text
/images/home/banner-msi.png
  -> https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/home/banner-msi.png
```

## Hướng dẫn cho warehouse

- Chọn hoặc tải ảnh trong bucket `media`, thư mục `products/`.
- Giá trị đầy đủ để lưu vào `SAN_PHAM.duong_dan_anh` có dạng:

  ```text
  https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/<đường-dẫn-file>
  ```

- Không chọn file trong `site/icons/`; đó là icon giao diện.
- Có thể tạo thư mục con trong `products/` để phân loại, nhưng đường dẫn lưu vào
  database phải gồm đầy đủ thư mục con và tên file.

## Quy ước từ nay

- Mọi ảnh dùng cho sản phẩm hoặc nội dung website đặt trong `media/products/`.
- Icon giao diện đặt trong `media/site/icons/`.
- Favicon và asset hệ thống ở gốc đặt trong `media/site/`.
- Không commit lại bản sao media vào `public/`.
- Khi thay nội dung một file, nên dùng tên file mới thay vì ghi đè đường dẫn cũ,
  vì object đang dùng cache `31536000` giây.
- Không đưa `SUPABASE_SECRET_KEY` hoặc service-role key vào frontend hay tài liệu.

## Kiểm tra

111/111 ảnh được đối chiếu SHA-256 với bản Git trước khi nguồn cũ bị xóa. Có
thể kiểm tra trạng thái bằng SQL:

```sql
select
  count(*) filter (where name like 'products/%') as product_objects,
  count(*) filter (where name like 'site/images/%') as old_site_images
from storage.objects
where bucket_id = 'media';
```

Kết quả kỳ vọng là `product_objects = 113` và `old_site_images = 0`.

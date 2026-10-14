# Danh mục cha–con trong LOAI_SP

Vẫn dùng một bảng `LOAI_SP`. Cột nullable `ma_loai_cha` tham chiếu `LOAI_SP.ma_loai_sp`:
`null` là danh mục gốc; mã cha là một danh mục đã có. `SAN_PHAM.ma_loai_sp` giữ nguyên.
Hỗ trợ nhiều cấp, ví dụ Linh kiện PC → Vi xử lý → CPU Intel.

## Cài đặt

1. Chạy [migration category_hierarchy](../migrations/20261013155334_category_hierarchy.sql) đúng một lần trên database đích, trước khi triển khai backend mới. Database mới cũng cần migration này sau `database/migrations/001_initial_schema.sql`.
2. Restart/deploy backend, sau đó frontend khách hàng và admin.
3. Tạo danh mục cha và gán `ma_loai_cha` cho các loại con qua **Admin → Loại sản phẩm** hoặc Swagger.

Migration chỉ thêm cột, khóa ngoại, index và trigger; không seed, xóa hay tự phân nhóm dữ liệu thật.
Các loại cũ có `ma_loai_cha=null`, vì vậy vẫn hiển thị như các danh mục gốc cho tới khi admin gán cha.
Không suy đoán danh mục bằng tên hoặc thương hiệu. Muốn menu như bản thiết kế, tạo/gán các mục gốc tương ứng với dữ liệu của cửa hàng.

## Ví dụ qua Swagger (tài khoản ADMIN)

Tạo cha bằng `POST /api/data/categories`:

```json
{"ma_loai_sp":"LINH_KIEN","ten_loai_sp":"Linh Kiện PC","ma_loai_cha":null,"trang_thai":1}
```

Nếu loại `CPU` đã tồn tại, dùng `PATCH /api/data/categories` với `key=["CPU"]` và body:

```json
{"ma_loai_cha":"LINH_KIEN"}
```

Nếu chưa có CPU, dùng POST với đủ mã/tên/trạng thái và `ma_loai_cha="LINH_KIEN"`.
Muốn chuyển con về gốc, PATCH `{"ma_loai_cha":null}`. Không gửi tên cha thay cho mã cha.
Các ví dụ trên chỉ minh họa; không phải tài khoản/danh mục được tạo sẵn.

## Hành vi API và menu

- `GET /api/catalog/categories` giữ `{items:[...]}`, mỗi phần tử có `id`, `name`, `parent_id`; chỉ trả loại đang hoạt động.
- `GET /api/catalog/products?category_id=LINH_KIEN` lấy sản phẩm của chính loại đó và mọi cấp con. Mở rộng loại trước lọc, sắp xếp, đếm và phân trang; nhiều `category_id` kết hợp OR, không lặp sản phẩm.
- Trạng thái độc lập theo loại, như trước: ẩn cha không tự ẩn con hay sản phẩm của con. Loại con hoạt động có cha bị ẩn được hiển thị ở cấp gốc trên menu. Muốn ẩn cả nhánh, cần ẩn các loại con tương ứng.
- Desktop lấy các mục gốc từ API. Bấm tên để xem sản phẩm của cả nhánh; nút mũi tên mở danh mục con. Escape/nhấp ngoài đóng menu.
- Mobile cho phép đi vào từng cấp, quay lại và xem tất cả sản phẩm của nhánh hiện tại.
- “Tất cả sản phẩm” là link bỏ lọc, không lưu trong LOAI_SP. Menu có trạng thái tải/lỗi/thử lại; không dùng danh mục giả khi API lỗi.
- Admin vẫn dùng form sinh từ metadata: thêm trường **Mã danh mục cha**, để trống khi là mục gốc. Backend không cho sửa khóa chính.

Database từ chối cha không tồn tại, tự tham chiếu và vòng lặp nhiều cấp/khi ghi nhiều dòng; API trả 422 cho lỗi khóa ngoại/check. Xóa cha có con bị chặn. Trigger dùng SECURITY INVOKER, không thay quyền bảng/RLS. Ghi cây được tuần tự hóa; giao dịch đồng thời có thể phải thử lại khi PostgreSQL báo deadlock. Dùng isolation READ COMMITTED (mặc định PostgREST) hoặc SERIALIZABLE, không dùng REPEATABLE READ cho thao tác sửa cây.

## Kiểm chứng

- Backend: `python -m pytest tests -q`; `python scripts/export_openapi.py --check`.
- SQL: trong database PostgreSQL **tạm riêng**, chạy lần lượt `tests/fixtures/category_schema.sql`, migration, `tests/category_hierarchy.sql` bằng `psql -v ON_ERROR_STOP=1 -f ...`. Tuyệt đối không chạy fixture lên database thật.
- Kiểm tra đồng thời: đặt `PHUB_CATEGORY_TEST_DSN` trỏ tới database local tên `category_test`, chạy `python -m pytest tests/test_category_concurrency.py -q` (cần psycopg2). Test từ chối host không phải 127.0.0.1 và tên database khác.
- UI: chạy Next.js rồi `node tests/category-hierarchy.e2e.cjs`. Có thể đặt `PHUB_USER_TEST_URL`, `PHUB_PLAYWRIGHT_MODULE`, `PHUB_CHROMIUM_PATH` theo môi trường. Fixture HTTP chỉ dùng trong test, không ghi database.

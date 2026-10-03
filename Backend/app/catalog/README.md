# API catalog công khai

API dùng chung cho UI khách hàng desktop/mobile. Phần này chỉ bổ sung code trong
`app/catalog`, đăng ký router ở `app/main.py`, kiểm thử và tài liệu. Không đổi
`/api/products`, Supabase client dùng chung, CORS, UI admin/kho hoặc cấu trúc DB.
File `.sql` ở root là **DBML mô tả schema**, không phải migration SQL để chạy.

## Chạy và Swagger

Từ thư mục `Backend`, dùng môi trường ảo và `.env` sẵn có của nhóm:

```powershell
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

- Swagger: `http://localhost:8000/docs`, nhóm **Public Catalog**.
- OpenAPI: `http://localhost:8000/openapi.json`.
- Public endpoints không yêu cầu đăng nhập; secret key chỉ được dùng ở backend.

## Endpoint và tham số

| GET | Kết quả |
| --- | --- |
| `/api/catalog/products` | `{items, pagination}` |
| `/api/catalog/products/{product_id}` | Một sản phẩm; `product_id` là `ma_sp`, không phải SKU |
| `/api/catalog/categories` | `{items: [{id, name}]}` từ các `LOAI_SP` hoạt động |
| `/api/catalog/brands` | `{items: [{name}]}` từ sản phẩm và loại sản phẩm hoạt động |

Tham số danh sách:

| Tham số | Quy tắc |
| --- | --- |
| `q` | Tối đa 100 ký tự sau khi trim; tìm chuỗi chứa trong tên **hoặc** SKU, không phân biệt hoa/thường |
| `category_id` | Mã loại, tối đa 100 ký tự/mã và 20 mã duy nhất; lặp tham số để chọn nhiều loại |
| `brand` | Chuỗi thương hiệu từ endpoint brands, tối đa 100 ký tự; so khớp chính xác |
| `page` | Số nguyên 1–2147483647; mặc định 1 |
| `page_size` | Số nguyên 1–100; mặc định 20 |
| `sort` | `default`, `price-asc`, `price-desc`; mặc định `default` |

```http
GET /api/catalog/products?q=MSI&category_id=LAPTOP&category_id=PC&brand=MSI&page=1&page_size=12&sort=price-asc
```

Các loại kết hợp bằng OR; tìm kiếm, nhóm loại và thương hiệu kết hợp bằng AND.
`q` và `brand` rỗng sau trim được bỏ qua; mã loại rỗng bị từ chối. Tham số không
được khai báo trả 422. Ký tự điều khiển bị từ chối. Ký tự tìm kiếm đặc biệt
`%`, `_`, `*`, dấu ngoặc, dấu phẩy, dấu nháy và backslash được tìm nguyên văn,
không được hiểu thành wildcard hoặc biểu thức lọc. Chưa hỗ trợ tìm không dấu.

Schema hiện có `SAN_PHAM.thuong_hieu` kiểu chuỗi, không có bảng/mã thương hiệu;
vì thế tham số chính thức là **brand**, thay cho brand_id trong đề xuất ban đầu.
Endpoint brands bỏ giá trị null/rỗng, loại trùng và đọc theo nhiều lô để không
chỉ lấy thương hiệu của trang sản phẩm đầu tiên. Endpoint này không tạo bảng/RPC.

## Trạng thái, giá và dữ liệu chi tiết

- Mặc định `SAN_PHAM.trang_thai = 1` và `LOAI_SP.trang_thai = 1` mới được công khai.
  Đọc cả danh sách, chi tiết và thương hiệu đều áp dụng điều kiện này.
- Đây là quy ước mặc định theo schema có `default: 1`; file DBML chưa mô tả enum.
  Nếu nhóm dùng giá trị khác, đặt **CATALOG_ACTIVE_STATUS** trong môi trường backend.
- Đang bán độc lập với tồn kho. Catalog không truy vấn `TON_KHO`, không công khai
  số lượng từng kho, giá nhập hoặc dữ liệu nhân sự. Chưa trả trường availability.
- Giá lấy từ `gia_ban_hien_tai`, cast text ở database trước khi nhận JSON và trả
  chuỗi có hai chữ số thập phân, ví dụ `"15990000.00"`. Sắp xếp dùng cột số gốc.
- Mặc định tiền tệ **VND**; có thể đặt **CATALOG_CURRENCY** bằng mã ba chữ cái viết hoa.
  Không quy đổi giá. DBML không có cột tiền tệ, nên đây là cấu hình chung của catalog.
- Mặc định sắp xếp theo `ma_sp`; sắp xếp giá dùng thêm `ma_sp` để xử lý giá trùng.
- Tổng kết quả được tính sau khi lọc, trước khi phân trang. Trang không có dữ liệu
  hoặc vượt phạm vi trả 200, `items: []`, giữ nguyên tổng phù hợp bộ lọc.
- `duong_dan_anh` ánh xạ thành `images: [{url, alt}]`. Hiện schema chỉ có một ảnh;
  thiếu ảnh trả `[]`. API không tự tạo gallery nhiều ảnh hay URL ảnh theo thiết bị.
- `thong_so_ky_thuat` hỗ trợ JSON object đơn giản, JSON array `{label, value}`,
  hoặc từng dòng `nhãn: giá trị`. Văn bản không tách được được giữ thành một mục
  `Thông số`; nội dung gốc luôn có trong `specifications_text`. Thiếu thông số
  trả `[]`. Không tự sinh cấu hình kỹ thuật cho sản phẩm.

Ví dụ phản hồi sản phẩm:

```json
{
  "id": "SP001",
  "sku": "MSI-001",
  "name": "Laptop MSI Modern",
  "category": {"id": "LAPTOP", "name": "Laptop"},
  "brand": "MSI",
  "price": "15990000.00",
  "currency": "VND",
  "description": "Laptop học tập",
  "unit": "Cai",
  "warranty_months": 24,
  "images": [{"url": "https://example.com/msi.jpg", "alt": "Laptop MSI Modern"}],
  "specifications": [{"label": "RAM", "value": "16 GB"}],
  "specifications_text": "RAM: 16 GB"
}
```

API chưa trả rating, giảm giá, màu sắc hoặc sản phẩm liên quan vì schema catalog
không có dữ liệu tương ứng. UI vẫn dùng fixtures; việc kết nối UI là bước riêng.
Các giá trị/mã trong ví dụ chỉ minh họa, cần lấy lựa chọn thật từ API metadata.

## Lỗi

Các lỗi của thao tác catalog đều trả cùng cấu trúc; không đổi handler toàn ứng
dụng hoặc lỗi của `/api/products` cũ:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Tham số không hợp lệ.",
    "details": [{"field": "page", "message": "Input should be greater than or equal to 1"}]
  }
}
```

| HTTP | Code | Khi nào |
| --- | --- | --- |
| 422 | `VALIDATION_ERROR` | Query hoặc mã sản phẩm không hợp lệ |
| 404 | `PRODUCT_NOT_FOUND` | Sản phẩm không tồn tại, ngừng hoạt động hoặc thuộc loại không hoạt động |
| 503 | `DATA_SERVICE_UNAVAILABLE` | Lỗi mạng, timeout hoặc dịch vụ dữ liệu không khả dụng |
| 500 | `INTERNAL_ERROR` | Sai schema/cấu hình, dữ liệu phản hồi không hợp lệ hoặc lỗi ngoài dự kiến |

Thông báo validation chi tiết của thư viện có thể là tiếng Anh. Exception nội
bộ được ghi log server và không được trả nguyên văn cho client. Quy tắc này áp
dụng các operation được khai báo, không thay đổi lỗi routing mặc định của app.

## Kiểm thử

Từ `Backend`:

```powershell
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m pytest -q
```

Kiểm thử dùng PostgREST client thật với HTTP transport giả lập, không cần `.env`
hay truy cập mạng. Có kiểm tra điều kiện công khai, tìm kiếm nguyên văn, bộ lọc
kết hợp, tổng/phân trang, sắp xếp, giá lớn, định dạng thông số, metadata nhiều
trang, các lỗi, Swagger và tương thích `/api/products` cũ.

Kiểm tra tích hợp **tùy chọn**, dùng `.env` hiện tại và chỉ đọc Supabase:

```powershell
.venv/Scripts/python.exe scripts/check_catalog.py
```

Script kiểm tra endpoint qua app thật, truy vấn bảng để đối chiếu sản phẩm công
khai, tìm tên/SKU, lọc, sắp xếp giá, trang vượt phạm vi, chi tiết, metadata và
Swagger. Không tạo/xóa/sửa dữ liệu và không in secret hoặc nội dung sản phẩm.
Đối chiếu toàn bộ danh sách chỉ thực hiện khi dữ liệu tham chiếu có tối đa 100
sản phẩm; dữ liệu lớn hơn vẫn kiểm tra mẫu và các tính chất của phản hồi.

Tài liệu kỹ thuật: [FastAPI custom routes](https://fastapi.tiangolo.com/how-to/custom-request-and-route/),
[PostgREST filtering](https://docs.postgrest.org/en/stable/references/api/tables_views.html).

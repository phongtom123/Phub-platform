# Bộ lọc theo loại sản phẩm

`GET /api/catalog/facets` nhận cùng query với `/api/catalog/products` và trả
`specs`, `brands`, `total`. Lựa chọn lấy từ sản phẩm công khai đang hoạt động
trong nhóm/loại được chọn; không dùng danh sách CPU/RAM giả định.

- `category_id` và `subcategory_id` kết hợp bằng AND. Nhiều mã trong cùng tham số dùng OR.
- `spec` lặp lại mảng JSON `[key,value]` từ facets, ví dụ `spec=["ram","16 GB"]`.
  Nhiều giá trị cùng key dùng OR; khác key dùng AND.
- Lọc thông số thực hiện trước phân trang, trên toàn bộ sản phẩm trong phạm vi.
  Tham chiếu linh kiện trong PC được giải tên giống trang chi tiết trước khi lọc.
- Số lượng mỗi lựa chọn xét các điều kiện khác, bỏ qua lựa chọn của chính trường đó.
  Tổ hợp không còn sản phẩm có count 0; UI cho bỏ chọn nhưng khóa chọn mới tổ hợp này.
- Khi một nhóm chứa nhiều loại, chỉ hiện thông số có mặt trong tất cả các loại đó.
  Văn bản mô tả không cấu trúc không được dùng làm lựa chọn thông số.
- Đổi loại trong dropdown xóa thông số và thương hiệu cũ; xóa điều kiện lọc giữ loại đang xem.
- Các dropdown chia sẻ một bản nháp trong RAM. Chuyển dropdown hoặc đóng/mở lại
  không mất lựa chọn. Chỉ nút Áp dụng chung bên ngoài mới cập nhật URL/kết quả.
  Chọn một mục thông số, thương hiệu, tình trạng hoặc loại sẽ tự đóng dropdown
  và đưa focus về nút mở; giá vẫn giữ hai ô để nhập đủ khoảng giá.
  Đổi loại cần áp dụng trước khi tải thông số của loại mới; không hiện thông số của loại cũ.
- UI cache tối đa 30 bộ kết quả facets trong RAM, dùng lại 60 giây. Đổi trang/sắp xếp
  không đổi key facets. Chỉ truy vấn khi áp dụng bộ lọc, không mỗi lần đánh dấu checkbox.

Không thay schema hoặc ghi dữ liệu Supabase. API scan các sản phẩm thuộc phạm vi
để đọc thông số hiện lưu dạng text/JSON; nếu catalog tăng lớn cần đánh giá lại
projection/index hoặc bảng thuộc tính chuẩn hóa. Không suy ra tổng từ một trang sản phẩm.

Kiểm tra: `pytest tests/test_catalog_facets.py tests/test_catalog_filters.py tests/test_catalog.py tests/test_openapi.py -q`.
UI: `node tests/catalog-dropdown-filters.e2e.cjs` với HTTP fixtures, không ghi dữ liệu thật.

# Gom request tồn kho và cache RAM cho giao diện khách hàng

Ngày kiểm tra: 04/11/2026. Phạm vi: trạng thái bán/tồn khả dụng trên thẻ sản phẩm,
xem nhanh và trang chi tiết. Chưa thay đổi cách tải ảnh hoặc các dãy sản phẩm.

## Cách hoạt động

- `StockBatch` dùng Map theo SKU trong RAM của tab trình duyệt. Các thẻ trùng SKU
  chia sẻ kết quả; cache mới dưới 15 giây được dùng lại khi chuyển trang.
- Gom các yêu cầu trong 25 ms; mỗi request tối đa 100 SKU, các lô chạy tuần tự.
  Một bộ refresh chung cập nhật mỗi 15 giây khi trang đang hiển thị/có mạng,
  đồng thời cập nhật khi quay lại tab hoặc có mạng trở lại.
- Cache giữ tối đa 256 mục khi không còn được quan sát; mục đang hiển thị hoặc
  đang tải được giữ đến khi dùng xong. Hủy request và dừng refresh khi không còn
  component sử dụng. Reload trang sẽ xóa cache RAM.
- `GET /api/catalog/purchase-states?sku=...&sku=...` chỉ đọc mã, SKU, trạng thái
  bán và số lượng khả dụng. Không tải lại ảnh/thông số kỹ thuật của từng sản phẩm.
  Hàng tạm ngừng được phân biệt với hết hàng; SKU ẩn/mất hoặc lỗi API không được
  thay bằng tồn bằng 0. API và Next.js gateway vẫn dùng `no-store`.
- Thêm giỏ, tiếp tục checkout và transaction đặt đơn vẫn kiểm tra tồn mới nhất,
  không lấy cache hiển thị làm căn cứ giữ hàng. Sau khi đặt đơn thành công, cache
  các SKU vừa đặt bị vô hiệu hóa. Cách gộp kho hoạt động/trừ reservation giữ nguyên.

## Kết quả đo và giới hạn

Đo bằng Chrome với 20 sản phẩm giả lập, Next.js dev tại localhost:3001:

| Số request kiểm tra tồn | Trước | Sau |
| --- | ---: | ---: |
| Tải trang ban đầu | 40 | 1 |
| Cộng lượt refresh đầu tiên sau 15 giây | 60 | 2 |

StrictMode trong dev tạo thêm lượt effect ở bản cũ. Đây là phép đo số request với
HTTP fixtures, không phải tốc độ tải Render hay cam kết trang nhanh hơn 40 lần.
Thử chỉ đọc qua gateway local với 5 SKU thật trả đủ 5 kết quả; thời gian một lượt
774 ms, chưa phải benchmark độ trễ. Không ghi đơn, thanh toán hoặc tồn kho.

## Kiểm thử lại

Tại `ui/userUI/Frontend`:

```text
node tests/stock-batch.test.cjs
node tests/stock-batch.e2e.cjs
node tests/product-card-actions.e2e.cjs
node tests/product-add-isolation.e2e.cjs
node tests/product-quantity.e2e.cjs
node tests/product-stock.e2e.cjs
node tests/cart-checkout-stock.e2e.cjs
```

Browser tests cần Playwright (`PHUB_PLAYWRIGHT_MODULE` nếu cài ngoài repo), Chrome
và user UI local. `PHUB_USER_TEST_URL` mặc định cần chọn localhost:3001; một số
test cũ mặc định 3000 nên đặt biến này rõ ràng. Test trạng thái/số lượng dùng một
sản phẩm công khai cho SSR; dữ liệu tồn và thao tác giỏ dùng fixtures.

Tại `Backend`:

```text
.venv\Scripts\python.exe -m pytest tests/test_catalog.py tests/test_catalog_filters.py tests/test_catalog_purchase_states.py tests/test_cart_availability.py tests/test_openapi.py tests/test_architecture.py -q
```

Khi đưa lên cloud cần deploy cả backend có endpoint mới và user UI tương ứng.
Không cần migration hoặc thay đổi dữ liệu Supabase.

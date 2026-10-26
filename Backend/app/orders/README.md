# Customer Orders API

`POST /api/orders` tạo đơn `ONLINE/MOI` thuộc khách đã xác minh, chưa thanh toán. Module
không thay catalog, UI admin/kho, phiếu xuất, hóa đơn hoặc các handler chung.
Xem mô tả cả bốn mục tiêu ở [Backend/README.md](../../README.md).

**Cập nhật mục tiêu 4:** body/receipt không voucher vẫn giữ nguyên, kể cả cùng SKU
phân bổ vào các kho khác nhau. Endpoint nay dùng dependency xác thực chung và RPC
`customer_checkout_v2` để chốt `ma_kh` từ Backend; không còn cho guest tạo đơn.
Auth thật chưa được nối nên mặc định trả 503 trước khi đọc/ghi database.
Cần migration ngày 04/10 rồi 06/10, cả hai **chưa áp dụng trên Supabase chung**.
Checkout UI sử dụng `/api/customer/orders` có voucher; xem [commerce README](../commerce/README.md).

## Hợp đồng request

Header bắt buộc: `Idempotency-Key`, UUID v4, ví dụ `0672b8b1-86ea-4f51-8668-1c722b8a9d99`.
Mỗi thao tác đặt mới dùng key mới. Retry do timeout/mất mạng dùng đúng key và nội dung cũ.

```json
{
  "recipient": {
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "address_line": "123 Đường thử nghiệm",
    "province": "TP Hồ Chí Minh",
    "ward": "Phường thử nghiệm"
  },
  "items": [
    {
      "sku": "SKU-DEMO",
      "warehouse_id": -900001,
      "quantity": 2,
      "expected_unit_price": "100000.00"
    }
  ],
  "note": "Gọi trước khi giao"
}
```

SKU/kho/giá trên chỉ minh họa; dùng dữ liệu thật đã được phép đặt. `warehouse_id`
là số nguyên có dấu, vì kho seed hiện có mã âm. Số lượng là số nguyên 1–1000;
1–100 dòng; cùng SKU được chọn kho khác nhau nhưng không lặp cùng SKU/kho.
Giá đối chiếu phải là chuỗi không âm, tối đa 16 chữ số nguyên và 2 chữ số thập phân.
Server không nhận giá chốt, thuế, tổng tiền, giảm giá hoặc mã nhân viên/khách từ client.

Tên tối đa 100 ký tự, địa chỉ 255, tỉnh/thành và xã/phường 100, ghi chú 2000.
Điện thoại được bỏ khoảng trắng, ngoặc và dấu gạch ngang, sau đó phải có 8–15 chữ
số và có thể bắt đầu bằng `+`. Ký tự điều khiển và trường không khai báo bị từ chối.
Thứ tự dòng, giá `100000`/`100000.00` và khoảng trắng đã chuẩn hóa không đổi hash.

## Kết quả và tiền

201 cho đơn mới, 200 cho replay; header `Idempotency-Replayed: false|true` và
`Cache-Control: no-store`. Receipt có mã đơn, thời gian UTC, người nhận, các dòng
snapshot và tổng. Các trường tiền trả dạng chuỗi hai chữ số thập phân.

Với ví dụ trên: `subtotal="200000.00"`, `tax_total="0.00"`, `total="200000.00"`,
`tax_application="invoice"`. Dòng có `tax_rate="10.00"` nhưng `tax_amount="0.00"`.
Thuế 10% chỉ được áp dụng khi phần hóa đơn lập hóa đơn. Response không công khai
giá nhập, thông tin nhân viên, tồn của các kho khác hay dữ liệu khách hàng khác.

RPC lưu receipt ban đầu để retry vẫn nhận cùng kết quả khi giá/tên sản phẩm hoặc
trạng thái đơn đã đổi. Không dùng `MAX(id)+1`; chi tiết sử dụng identity/serial
sẵn có của nhóm, đơn dùng UUID. Không tự xóa key theo TTL: tránh retry tạo lại đơn.
GET đơn không công khai theo mã: mục tiêu 4 bổ sung list/detail có kiểm tra quyền
sở hữu trong `app/commerce`; không tự gán lại các đơn cũ `ma_kh=NULL`.

Key tham chiếu đơn bằng khóa ngoại; cần giữ dữ liệu này cho idempotency. Nếu nhóm
có luồng xóa đơn vĩnh viễn, thống nhất cách lưu lịch sử/key trước khi dùng luồng đó.

## Lỗi thống nhất

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Thông tin đặt hàng không hợp lệ.",
    "details": [{"field": "items.0.quantity", "message": "..."}]
  }
}
```

| HTTP | Mã |
| --- | --- |
| 422 | `VALIDATION_ERROR`, `AMOUNT_OUT_OF_RANGE` |
| 401/403 | `AUTHENTICATION_REQUIRED`, `ACCESS_DENIED`, `AUTH_CUSTOMER_UNAVAILABLE` |
| 404 | `PRODUCT_NOT_AVAILABLE`, `WAREHOUSE_NOT_AVAILABLE` |
| 409 | `PRICE_CHANGED`, `INSUFFICIENT_STOCK`, `CHECKOUT_CHANGED`, `IDEMPOTENCY_CONFLICT`, `RETRYABLE_CONFLICT` |
| 503 | `AUTH_INTEGRATION_REQUIRED`, `ORDER_CONFIGURATION_REQUIRED`, `ORDER_DATABASE_NOT_READY`, `DATA_SERVICE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

Giá thay đổi: khách kiểm tra lại giá, xác nhận request mới rồi dùng key cho lần đặt
mới. Key đã thành công với nội dung khác luôn trả 409. Lỗi mạng không chứng minh
đơn chưa được ghi: retry bằng key cũ. Không lộ SQL exception hoặc thông tin người nhận
trong log lỗi của module. Swagger mô tả các model, request mẫu và trạng thái HTTP.

## Migration để nhóm duyệt — chưa chạy trên Supabase chung

1. Nhóm database chạy SQL **chỉ đọc** [inspect_order_schema.sql](../../migrations/inspect_order_schema.sql).
   Kiểm tra identity/serial của `CT_DON_HANG.ma_ct_donhang`, độ dài/precision,
   constraints và trigger; đặc biệt các trigger trừ kho hoặc tính thuế lúc tạo đơn.
2. Đối chiếu công thức giữ hàng trong [Backend README](../../README.md). Nhóm kho
   phải phối hợp khóa tồn, xuất hàng và đổi trạng thái đơn nguyên khối. Luồng xuất
   từng phần cần nghiệp vụ riêng, chưa được suy diễn trong API này.
3. Thử [20261004_customer_orders.sql](../../migrations/20261004_customer_orders.sql)
   trên staging có cùng schema/triggers trước. Migration tạo schema riêng
   `customer_order_private`, bảng idempotency và RPC `customer_create_order_v1`.
   Tiếp theo áp [20261006_customer_checkout.sql](../../migrations/20261006_customer_checkout.sql)
   để bổ sung transaction v2 dùng bởi endpoint hiện tại. V1 giữ lại trong migration
   gốc để không sửa lịch sử; HTTP hiện không gọi RPC guest v1.
   Không thêm/sửa cột bảng chung, không tạo phiếu xuất hoặc hóa đơn.
4. RPC chỉ cho `service_role` gọi, `SECURITY INVOKER`, `search_path` rỗng. Schema
   riêng không đưa vào exposed schemas; bảng bật RLS và không có policy công khai.
   Kiểm tra service role có quyền trên các bảng/sequence chung cần sử dụng.
5. Khi nhóm duyệt staging mới áp dụng trên Supabase chung. Migration chạy một lần
   và phát thông báo reload schema PostgREST; không tự áp dụng bằng startup Backend.
   Nếu identity/serial chưa có, migration dừng để nhóm sở hữu bảng xử lý.

Không tự sửa migration của nhóm khác hoặc các trigger để làm thử nghiệm vượt qua.
Nếu staging có trigger tính thuế/trừ kho sớm, cần thống nhất với chủ sở hữu trước
khi dùng RPC. Key/receipt có thông tin đơn nên không công khai hoặc đưa vào log.

## Kiểm thử

Từ `Backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

72 kiểm thử orders dùng transport Supabase/PostgREST giả lập, không cần ghi DB.
75 kiểm thử catalog tiếp tục chạy để kiểm tra hồi quy.

Để kiểm thử SQL thực, có thể cài công cụ tạm ngoài repository:

```powershell
npm.cmd install --prefix "$env:TEMP/phub-order-test-tools" --no-save --package-lock=false embedded-postgres@18.4.0-beta.17
$env:PHUB_EMBEDDED_POSTGRES_MODULE=([Uri]::new((Join-Path $env:TEMP 'phub-order-test-tools/node_modules/embedded-postgres/dist/index.js'))).AbsoluteUri
node scripts/check_orders_database.mjs
```

Script tự tạo cluster PostgreSQL trên loopback với cổng trống và thư mục TEMP riêng;
không nhận URL database bên ngoài, không đọc `.env` hoặc khóa Supabase. Fixture chỉ
áp dụng vào cluster này. 25 kiểm tra gồm cạnh tranh phần hàng cuối, key trùng đồng
thời, rollback lỗi insert, snapshot sau đổi sản phẩm, tiền thập phân, giữ/hủy/xuất
hàng mô phỏng và quyền RPC. Dừng cluster trong `finally`; giữ thư mục TEMP để xem
lại, không tự xóa đường dẫn. Không thay package.json/lockfile của ứng dụng.

Tham khảo cơ chế: [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html),
[Supabase database functions](https://supabase.com/docs/guides/database/functions).

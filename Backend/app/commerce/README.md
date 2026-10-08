# Tích hợp mua hàng khách hàng — mục tiêu 4

Module nối các API catalog, đặt đơn và thanh toán với giao diện khách hàng desktop/mobile.
Không làm lại đăng ký/đăng nhập, không sửa UI admin/kho, không tạo phiếu xuất,
hóa đơn hay giao dịch thu tiền. Mô tả cả bốn mục tiêu ở [Backend README](../../README.md);
cách chạy UI và kiểm thử ở [SHOPPING-INTEGRATION.md](../../../ui/userUI/Frontend/SHOPPING-INTEGRATION.md).

## Trạng thái và phần cần nhóm phối hợp

Code API, proxy và UI đã có. **Chưa áp dụng migration lên Supabase chung.**
Xác thực thật của thành viên khác chưa có trong workspace; tất cả API có dữ liệu
khách dùng chung `app/payments/auth.py::require_customer`, mặc định trả 503
`AUTH_INTEGRATION_REQUIRED` trước khi truy vấn database. Catalog vẫn công khai.
Không nhận `ma_kh` do frontend tự khai báo. Không có đăng nhập giả trong `app.main`.

Kiểm tra chỉ đọc Supabase đang cấu hình ngày 06/10/2026 xác nhận chưa có
`customer_create_order_v1`, `customer_checkout_v2` và `customer_read_orders_v2`
trong schema REST. Vì vậy chỉ đổi URL UI/backend không thể bật tạo đơn thật.
Không có kết nối quản trị SQL trong `.env` hiện tại; hai migration cần được
nhóm áp qua Supabase SQL Editor hoặc kết nối database được cấp cho việc này.
Việc chọn database triển khai và danh tính khách test cần được chốt trước khi
chạy luồng ghi thật. Catalog thật đã đạt 17 kiểm tra API chỉ đọc và 27 kiểm tra
trình duyệt với dữ liệu hiện có; không có thay đổi database trong các kiểm tra.

Để chạy với dữ liệu thật, nhóm cần nối dependency xác thực trả `CurrentCustomer`
từ tài khoản đã được kiểm chứng, và triển khai hai migration đã review trên staging
rồi database chung. Tài khoản cần liên kết `TAI_KHOAN.ma_kh`; đơn cũ `ma_kh=NULL`
không được tự gán lại. Hợp đồng token/cookie và security scheme trong Swagger
sẽ được hoàn thiện cùng module đăng nhập, không tuyên bố một cơ chế chưa tồn tại.

## API và Swagger

Nhóm Swagger **Customer Shopping**:

| Endpoint | Chức năng |
| --- | --- |
| `GET /api/customer/me` | Tên, điện thoại, địa chỉ mặc định của khách đã xác minh |
| `PUT /api/customer/me` | Lưu tên/điện thoại/địa chỉ nhận hàng mặc định của khách hiện tại |
| `POST /api/customer/checkout/quote` | Kiểm tra SKU/số lượng, chọn kho đủ hàng, tính giá và voucher |
| `POST /api/customer/orders` | Tạo đơn thuộc khách, chốt giá/giảm giá/người nhận, idempotent |
| `GET /api/customer/orders` | Lịch sử đơn của khách, phân trang |
| `GET /api/customer/orders/{order_id}` | Chi tiết và các dòng snapshot của đơn thuộc khách |
| `GET /api/customer/orders/{order_id}/invoice` | Tổng hóa đơn và dòng đơn thuộc khách; chưa có thì invoice=null |

Thanh toán dùng hai API sẵn có trong [payments](../payments/README.md).
`POST /api/orders` cũ giữ body/receipt không voucher, nhưng nay cũng cần khách
đã xác minh và gọi transaction v2 để ghi `ma_kh`. Cùng SKU ở các kho khác nhau
vẫn hợp lệ ở API cũ; checkout mới nhận một dòng cho mỗi SKU.

`GET /me` chỉ chọn cột công khai của `KHACH_HANG`; không trả mật khẩu/hash/email
đăng nhập. List/detail lọc quyền sở hữu trong chính RPC. Đơn không tồn tại,
thuộc khách khác hoặc không có chủ đều trả cùng 404 `ORDER_NOT_FOUND`.
List nhận `page=1..1000000`, `page_size=1..100` và từ chối query khác.
Khi RPC đọc chưa có, `reads.py` đọc bảng hiện có và lặp kiểm tra quyền sở hữu
trên dòng đơn. Chỉ fallback cho lỗi thiếu hàm, không bỏ qua lỗi quyền/schema khác.
Đọc hóa đơn không cần RPC. Tạo đơn vẫn cần RPC transaction; chưa chạy migration
theo lựa chọn 07/10. UI thử đầy đủ ở [PAYMENT-UI-REVIEW.md](../../../PAYMENT-UI-REVIEW.md).

`PUT /me` nhận cùng schema `Recipient` gồm `name`, `phone`, `address_line`,
`province`, `ward`. Validation trim chuỗi, chuẩn hóa số điện thoại, giới hạn độ
dài và từ chối trường thừa/mã khách. Chỉ cập nhật `ten_kh`, `sdt`,
`dia_chi_chi_tiet_md`, `tinh_thanh_md`, `xa_phuong_md` với `ma_kh` từ dependency
xác thực; không sửa tài khoản, không tạo khách/đơn/hóa đơn. API dùng Data API,
không cần RPC hoặc migration mới. Mọi lỗi theo `CommerceRoute` hiện có.
Thay đổi UI và cách kiểm tra: [CHECKOUT-REVIEW.md](../../../CHECKOUT-REVIEW.md).

Ví dụ quote:

```json
{"items":[{"sku":"SKU-A","quantity":2}],"voucher_code":"SAVE10"}
```

Quote chỉ đọc, không giữ hàng hoặc lượt voucher. Mỗi SKU được chọn một kho hoạt
động đủ tồn khả dụng, ưu tiên `ma_kho` nhỏ nhất. Không tự chia SKU sang nhiều kho
trong checkout; nếu không có kho đủ, trả `INSUFFICIENT_STOCK`.

Ví dụ tạo đơn sau quote (mã kho/SKU/giá cần lấy từ quote thật):

```json
{
  "recipient":{"name":"Khách thử","phone":"0901234567","address_line":"123 Đường thử","province":"TP Hồ Chí Minh","ward":"Phường thử"},
  "note":null,
  "voucher_code":"SAVE10",
  "expected_discount":"20000.02",
  "expected_total":"180000.18",
  "items":[{"sku":"SKU-A","warehouse_id":1,"quantity":2,"expected_unit_price":"100000.10"}]
}
```

Header `Idempotency-Key` bắt buộc UUID v4. 201 cho đơn mới, 200 cho replay;
`Idempotency-Replayed: false|true`. Key gắn với **khách đã xác minh và body chuẩn hóa**;
đổi khách hoặc body với key cũ trả 409. Replay trả receipt ban đầu kể cả giá,
voucher hoặc trạng thái đơn đã thay đổi. Mọi response thành công/lỗi đều `no-store`.

Request từ chối trường thừa và ký tự điều khiển. Giỏ 1–100 SKU duy nhất, số lượng
nguyên 1–1000, mã SKU/voucher tối đa 100 ký tự. Người nhận dùng validation của
orders: tên 100, địa chỉ 255, tỉnh/phường 100, ghi chú 2000; điện thoại chuẩn hóa
rồi kiểm tra 8–15 chữ số, có thể có `+`. Giá/tổng đối chiếu phải là chuỗi thập phân
không âm, tối đa 16 chữ số nguyên và 2 số thập phân. Server lấy giá chốt từ database.

## Voucher, tổng tiền và giữ hàng

Đọc `VOUCHER`, `CHUONG_TRINH_KHUYEN_MAI`, ghi `SU_DUNG_VOUCHER` trong cùng transaction
tạo đơn. Mã được trim/uppercase; mã trong database phải tuân theo quy tắc đó.
Cần voucher và chương trình `HOAT_DONG`, thời gian hiện tại trong khoảng hiệu lực,
đạt giá trị tối thiểu, chưa hết lượt toàn hệ thống hoặc mỗi khách.

- `PHAN_TRAM`: phần trăm 0–100, làm tròn hai số thập phân, áp trần `giam_toi_da` nếu có.
- `SO_TIEN`: giảm số tiền cố định. Tổng giảm luôn không vượt tiền sản phẩm.
- Giới hạn `NULL` là không giới hạn; 0 là không còn lượt. Chỉ đếm `DA_AP_DUNG`.
- Phân bổ giảm giá bằng tỷ lệ lũy kế và làm tròn để tổng các dòng khớp chính xác,
  không mất một xu hoặc khiến thành tiền dòng âm.
- `subtotal = tổng quantity × unit_price`, `total = subtotal − discount_total`.
  `expected_unit_price`, `expected_discount`, `expected_total` chỉ chống thay đổi
  sau khi khách xem quote; sai khác cần lấy quote mới và xác nhận lại.

Các thời điểm bắt đầu/kết thúc khuyến mãi trong schema là timestamp không timezone.
`CHECKOUT_PROMOTION_TIMEZONE` mặc định `Asia/Ho_Chi_Minh`; nhóm cần xác nhận cách lưu
timestamp trước triển khai. Thời gian ghi đơn mới là UTC; thời gian đọc bản ghi cũ
giữ biểu diễn database, không tự gắn timezone cho dữ liệu không có timezone.
Tiền tệ lấy `CATALOG_CURRENCY`; giữ cố định cho các đơn đã lưu vì schema chung
chưa có cột tiền tệ trên từng đơn.

Thuế suất snapshot 10%, tiền thuế lúc đặt **0**; hóa đơn mới áp thuế. UI có dòng
đỏ nhỏ “chưa áp dụng thuế 10%”. Chưa có API phí vận chuyển, nên UI ghi sẽ xác nhận
riêng, không cộng phí mẫu hoặc kết luận miễn phí. Module không nhận số thẻ/CVV.

Tồn khả dụng trừ các dòng của đơn `MOI/XAC_NHAN/DANG_CHUAN_BI`; tạo đơn giữ hàng
bằng chi tiết đơn, **không cập nhật TON_KHO**. Kho phải trừ tồn thực và chuyển
trạng thái xuất trong cùng transaction, tôn trọng lượng giữ và khóa dòng tồn.
Hủy đơn nhả lượng giữ; nhả lượt voucher cần phần sở hữu luồng hủy cập nhật usage
sang `DA_HUY` theo nghiệp vụ. Module này không tự sửa luồng hủy/xuất của nhóm.

Voucher được khóa để giới hạn lượt không bị vượt khi đặt đồng thời. Các luồng
ghi voucher khác cũng phải tuân thủ khóa và trạng thái usage. Giữ thứ tự khóa
tồn kho tương thích transaction trước. Lỗi rollback cả đơn, chi tiết, usage và key.

## Lỗi và trách nhiệm file

Lỗi chung `{"error":{"code":"...","message":"...","details":[]}}`.

| HTTP | Các mã chính |
| --- | --- |
| 401/403 | Xác thực thiếu/hết hạn, tài khoản không liên kết khách hoặc không có quyền |
| 404 | `ORDER_NOT_FOUND`, `PRODUCT_NOT_AVAILABLE`, `WAREHOUSE_NOT_AVAILABLE` |
| 409 | `PRICE_CHANGED`, `INSUFFICIENT_STOCK`, `CHECKOUT_CHANGED`, `IDEMPOTENCY_CONFLICT`, `RETRYABLE_CONFLICT`, lỗi voucher |
| 422 | `VALIDATION_ERROR`, `AMOUNT_OUT_OF_RANGE` |
| 503 | `AUTH_INTEGRATION_REQUIRED`, `ORDER_CONFIGURATION_REQUIRED`, database/mạng chưa sẵn sàng |
| 500 | `INTERNAL_ERROR`, phản hồi repository không hợp lệ |

Không trả/log SQL exception, thông tin người nhận, token hoặc dữ liệu giao dịch thô.

| File | Trách nhiệm |
| --- | --- |
| `schemas.py` | Validation và kiểm tra số tiền của quote/receipt, model hồ sơ/đơn |
| `rpc.py` | Tham số transaction từ cấu hình và khách tin cậy |
| `repository.py` | Hồ sơ allowlist, RPC quote/tạo/đọc đơn, lỗi allowlist |
| `router.py`, `errors.py` | Routes, Swagger, chuẩn hóa lỗi và no-store trong module |
| `../../migrations/20261006_customer_checkout.sql` | RPC service-role-only, ownership/idempotency/voucher/stock/snapshot |
| `../../tests/test_commerce.py` | 56 kiểm thử hợp đồng, quyền sở hữu, validation, lỗi và Swagger |
| `../../scripts/check_checkout_database.mjs` | 26 kiểm tra PostgreSQL thật riêng, có hai kết nối cạnh tranh |
| `../../scripts/shopping_e2e_app.py` | Backend fixture riêng cho trình duyệt; auth giả lập, không dùng Supabase |

## Migration và kiểm thử

Phiên test local được người dùng cho phép dùng khách đầu tiên `SEED_KH001`, đọc
Supabase thật qua cùng repositories, tách khỏi auth production. Đã sửa lỗi thêm
dấu ngoặc kép vào giá trị `.eq()` làm hồ sơ khách thật không khớp. Tại lần kiểm
tra 06/10/2026, Supabase chưa có RPC customer, `.env` chưa có kết nối SQL để cài.
Quote/voucher/tạo/đọc đơn còn trả `CHECKOUT_DATABASE_NOT_READY`. Xem
[hướng dẫn test thật](../../../CUSTOMER-SUPABASE-TESTING.md).

Nhóm review SQL chỉ đọc `migrations/inspect_order_schema.sql`, kiểm tra triggers,
constraints, FK, precision và serial/identity của `CT_DON_HANG.ma_ct_donhang` và
`SU_DUNG_VOUCHER.ma_su_dung`. Migration không tự thêm generator, sửa cột hoặc trigger.
Thứ tự trên staging: `20261004_customer_orders.sql`, sau đó `20261006_customer_checkout.sql`.
Hai RPC v2 `SECURITY INVOKER`, `search_path` rỗng, chỉ `service_role` được gọi;
key/receipt vẫn ở schema riêng không công khai. Cần quyền bảng/sequence tương ứng.
Đây là migration chạy một lần; không tự chạy lúc khởi động ứng dụng.

```powershell
# Từ Backend, không ghi Supabase
.\.venv\Scripts\python.exe -m pytest -q
$env:PHUB_EMBEDDED_POSTGRES_MODULE=([Uri]::new((Join-Path $env:TEMP 'phub-order-test-tools/node_modules/embedded-postgres/dist/index.js'))).AbsoluteUri
node scripts/check_checkout_database.mjs
```

Nếu chưa có công cụ: `npm.cmd install --prefix "$env:TEMP/phub-order-test-tools" --no-save --package-lock=false embedded-postgres@18.4.0-beta.17`.
Script SQL chỉ tạo cluster TEMP trên loopback, dừng trong `finally`, không đọc `.env`
hoặc nhận URL database chung. Fixture `tests/fixtures/commerce_schema.sql` **chỉ dùng kiểm thử**.
Các kiểm tra SQL bao gồm rollback, snapshot, quyền RPC, quota voucher, chia tiền lẻ,
tranh chấp lượt cuối, trùng key, giữ/hủy hàng và hồi quy body nhiều kho của API cũ.

E2E trình duyệt dùng routers/repositories thật với transport database giả lập và
phiên khách giả lập; SQL transaction được kiểm tra riêng trên PostgreSQL thật.
**Chưa chứng nhận E2E đăng nhập thật → Supabase thật**. Cách chạy và bước còn thiếu
được ghi rõ trong tài liệu frontend, không bật fixture server trong deployment.

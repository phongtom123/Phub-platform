# API thanh toán của khách hàng

> Tài liệu module trong cấu trúc MVC.

Cập nhật UI thử nghiệm 07/10: thêm điểm nối `POST /api/orders/{id}/payment-request`
nhận phương thức và UUID v4. Production chưa thực thi, trả 503 sau kiểm tra quyền
sở hữu, không ghi database/thu tiền; chỉ fixture riêng mô phỏng pending/idempotency.
Xem [PAYMENT-UI-REVIEW.md](../../../PAYMENT-UI-REVIEW.md).

Module chỉ đọc trạng thái thanh toán và lịch sử thu/hoàn tiền của đơn. Dữ liệu lấy
từ `DON_HANG` và `THANH_TOAN` hiện có; không cần migration mới, không tạo hoặc sửa
giao dịch, hóa đơn, tài khoản, UI đăng nhập, UI admin hay phần kho.

## Xác thực khách hàng dùng chung

Điểm nối nằm ở `app/dependencies/customer.py`. `require_customer()` phụ thuộc vào
guard khách hàng trong `app/services/auth.py`, nên dùng cùng cơ chế với admin và thủ kho:

- JWT chỉ nằm trong cookie HttpOnly `phub_session`; UI không đọc hoặc lưu token.
- Backend xác minh chữ ký, issuer, audience, hạn dùng và phiên bản mật khẩu.
- Backend tải lại `TAI_KHOAN` và `KHACH_HANG` ở mỗi request; tài khoản khóa, sai role
  hoặc không có `ma_kh` bị từ chối trước khi truy vấn đơn/thanh toán.
- Header `Authorization`, `X-Customer-Id`, query/body chứa mã khách không được dùng
  làm danh tính.
- `CurrentCustomer(customer_id=...)` chỉ được tạo từ `User` đã xác minh.

Pytest và fixture local vẫn có thể override `require_customer` bằng danh tính giả
để kiểm tra repository cô lập; ứng dụng production không đăng ký override cố định.

### Liên kết đơn với khách cũng cần phối hợp khi nối xác thực

Supabase đã có quan hệ `TAI_KHOAN.ma_kh -> KHACH_HANG.ma_kh` và
`DON_HANG.ma_kh -> KHACH_HANG.ma_kh`. API chỉ đọc đơn có `ma_kh` đúng với khách đã
xác minh. Đơn thuộc khách khác, không tồn tại, hoặc `ma_kh=NULL` đều trả cùng 404.

Mục tiêu 4 đã nối tạo đơn mới với cùng dependency: Backend lấy `ma_kh` từ khách
đã xác minh, không nhận mã khách tùy ý từ frontend. Checkout/chi tiết đơn có
màn hình trạng thái và lịch sử giao dịch. Đơn guest của phiên bản trước không
được tự gán lại. Auth thật và migration checkout vẫn cần nhóm tích hợp trước
khi chạy với dữ liệu thật; xem [commerce README](../commerce/README.md).

## Endpoint và hợp đồng công khai

| Endpoint | Kết quả |
| --- | --- |
| `GET /api/orders/{order_id}/payments` | Giao dịch mới nhất: thu hoặc hoàn tiền, phương thức, số tiền, trạng thái, thời gian và thông báo |
| `GET /api/orders/{order_id}/transactions` | Lịch sử cả thu và hoàn tiền, có phân trang |

`order_id` là mã chuỗi của bảng hiện có, không bắt buộc UUID: 1–100 ký tự sau khi
trim, không có ký tự điều khiển. Endpoint tóm tắt không nhận query. Lịch sử nhận
`page` mặc định 1, phạm vi 1–1.000.000 và `page_size` mặc định 20, phạm vi 1–100;
các query khác, kể cả `ma_kh`, bị từ chối khi xác thực đã được tích hợp.

Sắp theo `thoi_gian DESC NULLS LAST`, sau đó `ma_thanh_toan DESC` để thứ tự ổn định
khi thời gian bằng nhau. Khóa dùng sắp xếp không được chọn vào dữ liệu công khai.
Số lượng phân trang dùng `count=exact`; trang vượt kết quả trả danh sách rỗng,
kể cả khi PostgREST trả lỗi range 416.

Ví dụ tóm tắt khi giao dịch đang chờ, sau khi nối xác thực:

```json
{
  "order_id": "ORDER-A",
  "currency": "VND",
  "latest_transaction": {
    "type": "collection",
    "method": "bank_transfer",
    "amount": "100000.10",
    "status": "pending",
    "occurred_at": "2026-10-06T10:00:00",
    "message": "Khoản thu đang chờ xử lý; chưa được xác nhận thành công."
  },
  "message": "Khoản thu đang chờ xử lý; chưa được xác nhận thành công."
}
```

Lịch sử trả `order_id`, `currency`, `items` và
`pagination={page,page_size,total,total_pages}`. Mỗi item có cùng cấu trúc công
khai như `latest_transaction`; không có mã thanh toán hoặc mã giao dịch.
Thời gian giữ thông tin timezone mà database cung cấp, không tự gắn UTC vào
timestamp không có timezone; thời gian thiếu trả `null`.

### Trạng thái và số tiền

| Giá trị database | Giá trị công khai |
| --- | --- |
| `CHO_XU_LY` | `pending` — chưa được xác nhận thành công |
| `THANH_CONG` | `succeeded` — giao dịch đã được ghi nhận thành công |
| `THAT_BAI` | `failed` — giao dịch thất bại |
| Trạng thái chưa nhận diện | `unknown` — cần xác nhận lại, không lộ giá trị thô |
| `THU` / `HOAN_TIEN` | `collection` / `refund` |
| `TIEN_MAT` / `CHUYEN_KHOAN` / `THE` / `VI_DIEN_TU` | `cash` / `bank_transfer` / `card` / `e_wallet` |

Loại/phương thức chưa nhận diện cũng trả `unknown`. Không có giao dịch trả
`latest_transaction=null` với thông báo chưa có giao dịch được ghi nhận; không
giả định đã thanh toán hoặc đang chờ nếu database chưa có giao dịch chờ.

**Đây là trạng thái từng giao dịch và giao dịch mới nhất, không phải phép tính
đã tất toán toàn đơn.** Một khoản thu thành công có thể chỉ là thanh toán một
phần; một khoản hoàn tiền thành công không đồng nghĩa đơn đã được thanh toán.
Module không tự tính số dư nợ từ một dòng, không cộng các khoản đang chờ vào
tiền đã thu, không suy đoán phí/thuế hoặc tổng hóa đơn.

`so_tien` được cast thành text trong truy vấn trước khi nhận JSON, rồi validate
bằng Decimal; trả chuỗi hai chữ số thập phân, không âm, tối đa numeric(18,2).
Không cộng thuế 10% lần nữa: thuế thuộc luồng lập hóa đơn đã thống nhất.
`THANH_TOAN` hiện không có cột tiền tệ; module dùng `CATALOG_CURRENCY` (mặc định
`VND`) của Backend. Nhóm cần bảo đảm bảng thanh toán dùng cùng đơn vị tiền đó.

## Giới hạn dữ liệu và lỗi

Repository chỉ chọn cột cần thiết, không `select(*)`. Mỗi truy vấn thanh toán
lọc lại quan hệ `DON_HANG!inner` theo khách hiện tại, ngoài bước kiểm tra đơn
ban đầu. Kết quả cũng được kiểm tra quan hệ trước khi tạo model công khai.
Không trả `ma_thanh_toan`, `ma_giao_dich`, mã khách, thông tin người nhận, payload,
token, tài khoản ngân hàng hoặc dữ liệu nhà cung cấp. Module không log giá trị
giao dịch, mã đơn, thông tin khách, credential hay nội dung exception database.

Lỗi dùng `{ "error": { "code": "...", "message": "...", "details": [] } }`.
Cả thành công và lỗi có `Cache-Control: no-store`.

| HTTP | Mã |
| --- | --- |
| 401 | `AUTHENTICATION_REQUIRED` |
| 403 | `ACCESS_DENIED` |
| 404 | `ORDER_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` |
| 503 | `PAYMENT_SCHEMA_NOT_READY`, `PAYMENT_CONFIGURATION_REQUIRED`, `DATA_SERVICE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

## Code và kiểm thử

| File | Trách nhiệm |
| --- | --- |
| `app/dependencies/customer.py` | Adapter từ phiên JWT/cookie chung sang model khách đã được xác minh |
| `app/schemas/payments.py` | Validation mã đơn/query và các trường công khai |
| `app/repositories/payments.py` | Truy vấn chỉ đọc, kiểm tra sở hữu, Decimal, ánh xạ trạng thái/phương thức và phân trang |
| `errors.py` | Lỗi riêng cho module, che nội dung nhạy cảm, no-store |
| `app/api/payments.py` | Hai endpoint và Swagger nhóm Customer Payments |
| `../../tests/test_payments.py` | Kiểm thử API, điểm nối xác thực, sở hữu, lỗi, trạng thái, phân trang và dữ liệu không được lộ |
| `../../scripts/check_payments_schema.py` | Kiểm tra Supabase chỉ đọc với ID giả ngẫu nhiên, không đọc giao dịch thật |

Từ terminal tại `Backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_payments.py -v
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/check_payments_schema.py
```

Test payments dùng transport PostgREST giả lập và dependency khách đã xác minh
trong pytest. Bộ kiểm thử auth chung có thêm luồng đăng nhập khách qua cookie JWT
và adapter `require_customer`. Script schema xác minh FK join, cast tiền, filter và count trên
Supabase bằng mã giả; không đăng nhập khách, không đọc bản ghi giao dịch thật.

Swagger chạy cùng Backend tại `/docs`, nhóm **Customer Payments**. Không có phiên
trả 401; phiên nhân viên trả 403; phiên khách hợp lệ mới được kiểm tra quyền sở hữu
đơn. Cần kiểm thử tích hợp với hai khách khác nhau, khách bị khóa, phiên hết hạn và
đơn thuộc từng khách trên môi trường staging trước khi triển khai production.

Tổng quan cả ba mục tiêu: [Backend/README.md](../../README.md).

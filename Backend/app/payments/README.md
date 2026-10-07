# API thanh toán của khách hàng

Cập nhật UI thử nghiệm 07/10: thêm điểm nối `POST /api/orders/{id}/payment-request`
nhận phương thức và UUID v4. Production chưa thực thi, trả 503 sau kiểm tra quyền
sở hữu, không ghi database/thu tiền; chỉ fixture riêng mô phỏng pending/idempotency.
Xem [PAYMENT-UI-REVIEW.md](../../../PAYMENT-UI-REVIEW.md).

Module chỉ đọc trạng thái thanh toán và lịch sử thu/hoàn tiền của đơn. Dữ liệu lấy
từ `DON_HANG` và `THANH_TOAN` hiện có; không cần migration mới, không tạo hoặc sửa
giao dịch, hóa đơn, tài khoản, UI đăng nhập, UI admin hay phần kho.

## Phần còn thiếu: kết nối xác thực của thành viên phụ trách đăng nhập

**Code đăng ký/đăng nhập thật chưa có trong workspace hiện tại. Phần này được để
riêng theo yêu cầu của bạn; module không tự làm lại đăng nhập.** Vì chưa có hợp đồng
token/cookie hoặc hàm xác thực của nhóm, chưa thể xác định khách nào đang gọi API.

Điểm nối nằm ở [auth.py](auth.py):

- `CurrentCustomer(customer_id=...)` là kết quả tin cậy của Backend sau xác thực.
- `require_customer()` hiện luôn trả **503 `AUTH_INTEGRATION_REQUIRED`**.
- Cả hai endpoint bị chặn trước khi truy vấn database, kể cả có header
  `Authorization`, cookie, `X-Customer-Id` hay mã khách tự khai báo.
- Không có chế độ đọc công khai theo mã đơn. Khách chỉ xem catalog không cần tài
  khoản; tra cứu thanh toán phải xác minh danh tính và quyền sở hữu đơn.

Khi phần đăng nhập được gộp, thành viên phụ trách cần cung cấp:

1. Hàm/dependency xác thực thật và định dạng kết quả: tài khoản đã xác minh, trạng
   thái hoạt động, `ma_kh`; quy tắc token/cookie, hết hạn và tài khoản bị khóa.
2. Adapter ở `require_customer()` sử dụng kết quả đó rồi trả `CurrentCustomer`.
   Không lấy danh tính trực tiếp từ query, body, cookie thô hoặc token chỉ được
   decode mà chưa xác minh.
3. Nếu module đăng nhập chỉ trả `ma_tk`, adapter ánh xạ **tài khoản đã xác minh**
   qua `TAI_KHOAN.ma_kh`. Tài khoản nhân viên hoặc không liên kết khách phải bị từ
   chối; không tự tạo `KHACH_HANG` hay lấy email/số điện thoại để đoán khách.
4. Giữ lỗi 401/403 từ phần xác thực; `PaymentRoute` chuyển thành lỗi công khai
   nhất quán. Bổ sung cơ chế xác thực thực tế vào Swagger sau khi chốt hợp đồng.
   Hiện Swagger chưa tuyên bố một token/cookie nào được hỗ trợ.

Có thể tích hợp bằng cách sửa dependency này để gọi module xác thực của nhóm,
hoặc đăng ký dependency đã xác minh trong bước tạo app:

```python
from app.payments.auth import require_customer

# verified_customer_dependency là hàm thật do module xác thực cung cấp.
# Hàm phải trả CurrentCustomer và xác minh tài khoản trước khi trả kết quả.
app.dependency_overrides[require_customer] = verified_customer_dependency
```

Nếu dùng dependency override, cần cập nhật khai báo xác thực trong OpenAPI riêng;
override runtime không tự thay đổi khai báo security của dependency ban đầu.
**Không đăng ký một dependency trả khách cố định trong ứng dụng chạy thật.**
Khách giả lập chỉ xuất hiện trong pytest và backend fixture riêng cho E2E;
fixture không được import bởi ứng dụng thật và không kết nối Supabase.

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
| 401 | `AUTHENTICATION_REQUIRED` — sau khi nối xác thực |
| 403 | `ACCESS_DENIED` — sau khi nối xác thực |
| 404 | `ORDER_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` |
| 503 | `AUTH_INTEGRATION_REQUIRED`, `PAYMENT_SCHEMA_NOT_READY`, `PAYMENT_CONFIGURATION_REQUIRED`, `DATA_SERVICE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

## Code và kiểm thử

| File | Trách nhiệm |
| --- | --- |
| `auth.py` | Điểm nối xác thực còn thiếu, model khách đã được xác minh |
| `schemas.py` | Validation mã đơn/query và các trường công khai |
| `repository.py` | Truy vấn chỉ đọc, kiểm tra sở hữu, Decimal, ánh xạ trạng thái/phương thức và phân trang |
| `errors.py` | Lỗi riêng cho module, che nội dung nhạy cảm, no-store |
| `router.py` | Hai endpoint và Swagger nhóm Customer Payments |
| `../../tests/test_payments.py` | Kiểm thử API, điểm nối xác thực, sở hữu, lỗi, trạng thái, phân trang và dữ liệu không được lộ |
| `../../scripts/check_payments_schema.py` | Kiểm tra Supabase chỉ đọc với ID giả ngẫu nhiên, không đọc giao dịch thật |

Từ terminal tại `Backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_payments.py -v
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/check_payments_schema.py
```

Đã đạt **68 kiểm thử payments**, toàn bộ **214 kiểm thử Python** gồm cả 75 catalog
và 71 orders; **5 kiểm tra schema/query Supabase chỉ đọc** đã đạt. Test payments
dùng transport PostgREST giả lập và dependency khách đã xác minh giả lập trong
pytest. Chúng kiểm tra phần thanh toán độc lập, không chứng minh đăng nhập thật
đã được tích hợp. Script schema xác minh FK join, cast tiền, filter và count trên
Supabase bằng mã giả; không đăng nhập khách, không đọc bản ghi giao dịch thật.

Swagger chạy cùng Backend tại `/docs`, nhóm **Customer Payments**. Thử hai
endpoint lúc này sẽ thấy 503 `AUTH_INTEGRATION_REQUIRED`; đây là hành vi dự kiến.
Để thử phản hồi thành công độc lập, chạy pytest ở trên. Sau khi nối xác thực,
cần thêm kiểm thử tích hợp đăng nhập thật với hai khách khác nhau, khách bị khóa,
token/session hết hạn và đơn thuộc từng khách trên môi trường thử nghiệm.

Tổng quan cả ba mục tiêu: [Backend/README.md](../../README.md).

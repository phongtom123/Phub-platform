# Kiến trúc backend PHUB

Backend dùng **3 lớp: Controller → Service → Repository**. Ba UI Next.js vẫn
độc lập; backend vẫn là một ứng dụng FastAPI, chạy bằng `phub_api.main:app`.
Chỉ dùng package `phub_api/`; không giữ thư mục `Backend/app` hoặc import `app.*`.
Kiểm thử kiến trúc chặn việc đưa cấu trúc cũ trở lại, kể cả thư mục cache sót lại.
Không phải MVP; tên `models/` và `controllers/` không có nghĩa backend render View.

```text
Next.js gateway
    ↓ HTTP
controllers/       endpoint + request/response
    ↓ gọi use case
services/          nghiệp vụ, phân quyền nghiệp vụ, ánh xạ kết quả
    ↓ gọi phương thức repository
repositories/      truy vấn PostgREST, Storage và SQL RPC
    ↓
Supabase
```

## Cấu trúc và trách nhiệm

```text
phub_api/
  main.py                 # Ghép controller, middleware và vòng đời kết nối
  controllers/            # APIRouter/decorator và HTTP handler nằm cùng file
  services/               # AuthService, AccountsService, CatalogService...
  repositories/           # AuthRepository, AccountsRepository, CatalogRepository...
  models/                 # User, CurrentCustomer, Resource, lỗi và bất biến dữ liệu
  schemas/                # Pydantic request/response, model động và ví dụ OpenAPI
  dependencies/           # Ghép repository/service, lấy người dùng, guard theo role
  middleware/             # CORS, cookie, exception → HTTP response
  config/                 # Settings, Supabase pool/transport và OpenAPI
tests/
scripts/
migrations/
```

Không còn thư mục `api/` tách rời: URL, response model, mô tả Swagger và handler
của một endpoint được tìm trong cùng file controller. `config/openapi.py`
chỉ mở rộng tài liệu, không chứa xử lý nghiệp vụ. Model request động của các
bảng nằm ở `schemas/resources.py`, không trộn vào metadata `models/resources.py`.

## Quy tắc phụ thuộc

- **Controller:** xử lý HTTP, validation hình thức, Origin, cookie và response
  header/status; gọi service. Không import repository hoặc client database.
- **Service:** nhận dữ liệu/actor/repository, kiểm tra nghiệp vụ và dựng kết quả.
  Không nhận `Request`/`Response`, không gọi `.table()`, `.rpc()`, `.execute()`
  hoặc Storage. Không import controller, dependency hoặc middleware.
- **Repository:** chỉ đọc/ghi dữ liệu, giới hạn projection, filter ownership,
  phân trang và gọi RPC. Không gọi service hay tự dựng HTTP response.
- **Dependency:** là nơi ghép các lớp. Guard xác thực gọi AuthService; không
  truy vấn database trực tiếp. Mỗi request vẫn kiểm tra lại trạng thái, role
  và phiên bản mật khẩu; không cache quyền để che lỗi kết nối.
- **Model/schema:** không phụ thuộc ngược vào các lớp xử lý. Lỗi nghiệp vụ
  có mã của catalog/order/payment nằm trong `models/errors.py`; middleware
  chuyển chúng thành envelope HTTP hiện hữu.

Đây là layered architecture thực dụng, không áp đặt Clean Architecture/ORM hoặc
interface cho mọi class. Service hiện giữ các mã lỗi HTTP của contract cũ;
refactor không thay đổi response, lỗi hoặc cách phân quyền đã công bố.

## Lần theo một chức năng

Ví dụ tạo tài khoản:

1. `controllers/admin_accounts.py`: `POST /api/admin/accounts`, nhận schema.
2. `dependencies/admin_accounts.py`: xác thực ADMIN/Origin và cung cấp service.
3. `services/admin_accounts.py`: kiểm tra người sở hữu/role và dữ liệu mật khẩu,
   xây tham số tạo mới và kiểm tra kết quả.
4. `repositories/admin_accounts.py`: gọi đúng một RPC để tạo người + tài khoản.
5. SQL RPC trong migration đảm bảo transaction, khóa và tính duy nhất.

Với catalog/order/payment/commerce, mở lần lượt ba file cùng tên trong
`controllers/`, `services/`, `repositories/`. Các phần đọc đơn và tính tồn khả
dụng được tách thành helper service/repository nhỏ, không nhét vào controller.

## Transaction và tương thích

Các quy tắc cần atomicity (giá/snapshot, voucher, tồn kho, idempotency) vẫn giữ
trong SQL RPC. Service điều phối và giải nghĩa kết quả; repository gọi RPC.
Không thay transaction bằng nhiều thao tác HTTP insert/update riêng rẽ.
Không chạy migration, seed hoặc ghi dữ liệu Supabase trong đợt refactor này.

Giữ nguyên entrypoint, URL, query/body, response, cookie/Bearer và OpenAPI.
Health là ngoại lệ có chủ đích: controller trả trạng thái tiến trình, không
gọi service/database vì không có nghiệp vụ và không xác nhận DB đang kết nối.

## Thêm hoặc sửa chức năng

1. Đặt request/response trong `schemas/<nghiep_vu>.py`.
2. Thêm truy vấn cần thiết trong `repositories/<nghiep_vu>.py`.
3. Thực hiện use case và các kiểm tra trong `services/<nghiep_vu>.py`.
4. Ghép dependency, khai báo route mỏng trong controller tương ứng.
5. Thêm test service dùng repository giả lập, test repository/HTTP dùng
   MockTransport; kiểm tra actor khác role, ownership, lỗi và dữ liệu nhạy cảm.
6. Chạy test và kiểm tra OpenAPI trước khi bàn giao.

```powershell
.venv/Scripts/python.exe -m pytest tests -q
.venv/Scripts/python.exe scripts/export_openapi.py --check
```

`tests/test_architecture.py` chặn import ngược lớp, truy vấn DB/Storage ngoài
repository và việc tạo lại package `api/` trùng controller.
`tests/test_service_boundaries.py` kiểm tra nghiệp vụ bằng repository giả lập.
Toàn bộ pytest chặn HTTP thật để không vô tình dùng key trong `.env` của lập trình viên.
Scripts kiểm tra Supabase thật là thao tác riêng, không chạy tự động trong pytest.

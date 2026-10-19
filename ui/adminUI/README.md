# PHUB Admin UI

Giao diện quản trị cho nền tảng bán PC và linh kiện máy tính, được xây dựng bằng Next.js, React và TypeScript.

Đăng nhập và phần **Tài khoản** đã dùng API FastAPI/Supabase thật. Tài khoản có
danh sách, tìm kiếm/lọc/phân trang, tạo, chi tiết, chỉnh sửa, ẩn/khóa/mở lại,
phân quyền nhân viên và cấp lại mật khẩu. **Tài khoản của tôi** cho phép sửa thông
tin đăng nhập và đổi mật khẩu bằng mật khẩu hiện tại. Không có thao tác xóa.

Dashboard và danh sách dùng dữ liệu API; không có bản ghi mẫu thay thế. Các chức năng chưa tích hợp hiển thị trạng thái chưa khả dụng.

## Chức năng giao diện

Admin xác nhận `/auth/me` một lần khi mở ứng dụng/F5. Đăng nhập thành công dùng
ngay danh tính do backend trả về từ `/auth/login`, không gọi thêm `/auth/me`.
`AuthProvider` ở root layout giữ thông tin phiên trong bộ nhớ khi chuyển trang;
không lưu token hoặc tin quyền từ localStorage. Điều hướng nội bộ dùng `Link`/
`router.push`, không tải lại document và không gọi `/auth/me` theo từng trang.
Không kiểm tra lại khi focus/quay lại tab/cửa sổ, chuyển trang hoặc bằng timer.
Chỉ cập nhật hồ sơ tài khoản đang đăng nhập và nút **Thử kết nối lại** mới yêu cầu
kiểm tra thêm; các yêu cầu đồng thời dùng chung một request và không chặn UI đã xác thực.

HTTP 401 từ API dữ liệu đưa về đăng nhập ngay; 403 của API dữ liệu chỉ báo thiếu
quyền, không tự đăng xuất. Riêng `/auth/me` trả 401/403 thì phiên không hợp lệ.
Lỗi mạng/503 không xóa cookie hoặc coi phiên đã hết hạn.
Khi chưa xác nhận được phiên, màn hình chờ/báo lỗi không mở dashboard. Nếu phiên
đã được xác nhận trước đó, giữ màn hình và báo lỗi kiểm tra lại; backend vẫn kiểm
tra quyền trên từng request, không bỏ qua tài khoản bị khóa. Có nút **Thử kết nối lại**,
không có timer reload, tự gửi lại login hay thao tác ghi dữ liệu.
Số tổng sản phẩm/khách hàng chỉ lấy một dòng và `total`, không tải 100 dòng bỏ đi.
Backend xử lý retry có giới hạn cho request đọc; xem [hướng dẫn](../../Backend/README.md#xử-lý-kết-nối-lỗi-tạm-thời-503).

### Cache dữ liệu khi chuyển trang

`adminFetch` giữ response GET JSON thành công trong bộ nhớ riêng của tab: dữ liệu
danh sách/chi tiết/tài khoản/thống kê và metadata cấu trúc bảng tối đa **10 phút**
(cấu hình tạm để demo, `READ_CACHE_TTL_MS` trong `src/lib/admin-fetch.ts`).
Các trang dùng chung cache; quay lại danh sách/chi tiết đã mở trong TTL
không cần gọi API. Search, page, key bản ghi, bộ lọc và `order_id` có cache key
riêng; các request trùng đang chờ dùng chung một lần gọi mạng. Hủy một reader
không hủy request của reader khác; hủy hết thì dừng request. Có giới hạn LRU
80 mục, 8 MiB tổng và tối đa 2 MiB mỗi response.

Nút **Làm mới**, **Thử lại**, **Làm mới thống kê** xóa cache để đọc server ngay.
POST/PATCH/PUT/DELETE (gồm upload) không được cache/retry; xóa cache trước và sau
thao tác, kể cả lỗi/timeout vì server có thể đã ghi. UI vẫn áp dụng response đã
lưu vào đúng hàng/form, không refetch ngay; lần mở trang tiếp theo lấy bản mới.
Read bắt đầu trước khi xóa cache không được đưa dữ liệu cũ trở lại cache.

Cache mất khi F5/đóng tab, đăng nhập/đăng xuất/đổi danh tính hoặc API trả 401;
không lưu localStorage/IndexedDB, không chia sẻ cache server giữa người dùng,
không cache `/auth/*`, `/admin/me`, lỗi HTTP/JSON, response đặt cookie hoặc
request có header/credential riêng. Backend và gateway vẫn dùng HTTP `no-store`;
đây là cache trong bộ nhớ ứng dụng, không phải cookie/token hay quyền offline.
Khi hết TTL phải gọi API lại, không dùng bản hết hạn để che lỗi kết nối.

Thay đổi từ người dùng/hệ thống khác có thể hiển thị chậm tối đa TTL; bấm
**Làm mới** để xem ngay. Lần đầu mở hoặc Render đang khởi động vẫn cần chờ mạng.
Cache không giữ server free luôn thức và không bỏ qua xác thực lần mở/F5 hay
kiểm tra quyền/quy tắc dữ liệu khi backend thực hiện thao tác ghi.

Nội dung dùng toàn bộ chiều rộng còn lại bên cạnh sidebar, kể cả khi thu gọn trên
màn hình rộng; không giữ giới hạn 1600 px gây khoảng trắng. Mobile vẫn dùng bảng
cuộn ngang trong khung, không đẩy tràn toàn trang. Tiêu đề danh sách trùng với
breadcrumb được ẩn thị giác nhưng giữ cho trình đọc màn hình. Bỏ các thông báo
kỹ thuật nguồn API/Supabase/chế độ chỉ đọc và tên cột database dưới ô nhập;
vẫn giữ lỗi, trạng thái lưu, dữ liệu rỗng và cảnh báo tác động của thao tác.

Breadcrumb các trang dữ liệu chỉ hiển thị một lần trên header, với link đến danh sách,
chi tiết và chỉnh sửa. Dashboard không nhúng breadcrumb/link bảng liên quan của đơn hàng.
Trang chi tiết bỏ tiêu đề module lặp (Sản phẩm, Kho, Tài khoản…), dùng một hàng
**Quay lại — Chỉnh sửa**, Quay lại sát trái và Chỉnh sửa sát phải. Áp dụng cho các bảng dữ liệu và chi tiết tài khoản;
bảng chỉ đọc chỉ có Quay lại, không hiện Chỉnh sửa khi đang tải/lỗi. Danh sách,
form thêm/sửa và trang tài khoản của tôi vẫn giữ tiêu đề phù hợp.
Tài khoản chỉ dùng breadcrumb trên header, bao gồm mã tài khoản, trang thêm mới hoặc
hồ sơ cá nhân; sửa trực tiếp trong bảng không có breadcrumb riêng. Không lặp
breadcrumb xanh trong nội dung. Trang chi tiết gom các nút
Tạm khóa, Ẩn tài khoản hoặc Mở khóa / hiện lại cùng nhóm bên phải với Chỉnh sửa.
Trên màn hình hẹp nhóm nút tự xuống dòng để không tràn ngang; quyền tự khóa/ẩn
tài khoản của chính mình và xác nhận trước khi đổi trạng thái vẫn giữ nguyên.
Card thông tin tài khoản, phân quyền nhân viên và cấp lại mật khẩu dùng cùng lưới: 5 cột trên desktop
lớn, 3 cột trên desktop nhỏ, 2 cột trên tablet và 1 cột trên điện thoại. Hai ô
mật khẩu chiếm hai cột đầu, không kéo giãn hết card; giữ nền trắng, viền mảnh và bo góc.
Mọi trang `/accounts/[id]` dùng cùng khung 3 card theo thứ tự: thông tin tài khoản,
phân quyền nhân viên, cấp lại mật khẩu. Giữ cùng lưới thông tin, card và nhóm nút
ở mọi tài khoản. Hai ô Tìm kho/Kho phụ trách chỉ hiện khi chọn vai trò Nhân viên kho
trên tài khoản nhân viên khác có thể phân quyền; quản trị viên, khách hàng và tài
khoản đang đăng nhập không hiện hai ô không áp dụng. Đổi lựa chọn vai trò cập nhật
ẩn/hiện ngay, không cần lưu trước. Khách hàng vẫn có card phân quyền nhưng
hiện vai trò Khách hàng và khóa form; không có thao tác nâng quyền khách hàng.
Khi `is_self=true`, các form quản trị và nút khóa/ẩn vẫn hiện nhưng bị vô hiệu hóa
(cả control và submit handler); có hướng dẫn đổi mật khẩu qua `/account`.
Kho chỉ được chọn cho nhân viên kho. Không thay đổi endpoint hoặc quyền backend.
Header thu gọn tìm kiếm/thông tin người dùng trên màn hình vừa để breadcrumb
không bị che và vẫn bấm được khi chuyển tài khoản trên tablet.
Trong chi tiết đơn hàng, nhóm thông tin liên quan mở các trang dòng hàng, hóa đơn,
thanh toán và voucher với bộ lọc `order_id` chính xác ở backend. Cần deploy backend
hỗ trợ bộ lọc này; UI báo lỗi rõ ràng nếu API đang chạy bản cũ, không hiện dữ liệu khác đơn.

Dashboard có 4 biểu đồ dùng dữ liệu API thật: số đơn theo ngày (7/30/90 ngày, giờ
Việt Nam), trạng thái đơn, tổng số lượng tồn theo kho và kênh bán. Hai biểu đồ phân
bố đơn dùng tất cả đơn, gồm đơn hủy; không coi số đơn là doanh thu. Có làm mới,
bảng số liệu, trạng thái tải/lỗi/rỗng; không có dữ liệu mẫu thay thế. UI tải đầy đủ
các trang, tối đa 20.000 dòng mỗi tập; dữ liệu lớn hơn cần API tổng hợp riêng,
không thống kê trên mẫu bị cắt. Chưa thêm endpoint hoặc migration cho phần chart.

- Đăng nhập quản trị viên.
- Dashboard tổng quan hoạt động kinh doanh.
- Quản lý đơn hàng, hóa đơn và thanh toán.
- Quản lý khách hàng và tài khoản.
- Quản lý sản phẩm, danh mục và tồn kho.
- Quản lý phiếu nhập, chuyển kho và nhà cung cấp.
- Quản lý kho và nhân viên (DB không còn chi nhánh).
- Quản lý chương trình khuyến mãi và voucher.
- Trang xem chi tiết và chỉnh sửa riêng cho từng bản ghi.
- Sidebar dạng thu gọn/mở rộng và các nhóm menu dạng dropdown.
- Giao diện responsive cho máy tính và thiết bị di động.

## Công nghệ sử dụng

- [Next.js 15](https://nextjs.org/)
- [React 19](https://react.dev/)
- TypeScript
- Lucide React Icons
- CSS thuần

## Yêu cầu môi trường

Cài đặt các công cụ sau trước khi chạy dự án:

- Node.js 20 trở lên.
- npm 10 trở lên.
- Git.

Kiểm tra phiên bản đang sử dụng:

```bash
node --version
npm --version
git --version
```

## Cài đặt và chạy dự án

### 1. Tải source code

```bash
git clone https://github.com/phongtom123/Phub-platform.git
cd Phub-platform
git checkout main
cd ui/adminUI
```

Nếu đã có source code trên máy, mở terminal tại `ui/adminUI`, nơi có `package.json`.
Chạy backend theo [Backend README](../../Backend/README.md) trước khi đăng nhập.
Tạo `.env.local` theo `.env.example`:

```dotenv
PHUB_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WAREHOUSE_URL=http://localhost:3002
NEXT_PUBLIC_CUSTOMER_URL=http://localhost:3001
```

Không đặt Supabase secret hoặc JWT secret vào UI. Backend phải có Supabase URL,
secret, JWT secret và `FRONTEND_ORIGINS` chứa `http://localhost:3000`.
Tài khoản đầu tiên tạo theo Backend README; không có tài khoản demo hardcode.

### 2. Cài đặt thư viện

```bash
npm install
```

### 3. Chạy môi trường phát triển

```bash
npm run dev
```

Mở trình duyệt tại:

```text
http://localhost:3000
```

Khi chỉnh sửa source code, trình duyệt sẽ tự động cập nhật giao diện.

## Build và chạy bản production cục bộ

```bash
npm run build
npm run start
```

Sau đó truy cập `http://localhost:3000`.

## Kiểm thử giữ phiên và điều hướng

```powershell
node --test ui/adminUI/tests/*.test.cjs ui/shared/tests/*.test.cjs
$env:PHUB_PLAYWRIGHT_MODULE='C:/temp/phub-browser-tests/node_modules/playwright'
$env:PHUB_ADMIN_TEST_URL='http://localhost:3000'
node ui/adminUI/tests/session-navigation.e2e.cjs
node ui/adminUI/tests/session-recovery.e2e.cjs
node ui/adminUI/tests/page-actions.e2e.cjs
node ui/adminUI/tests/account-detail-consistency.e2e.cjs
node ui/adminUI/tests/account-inline-edit.e2e.cjs
node ui/adminUI/tests/account-status.e2e.cjs
node ui/adminUI/tests/inline-data-table.e2e.cjs
node ui/adminUI/tests/admin-cache.e2e.cjs
```

Các lệnh trên chạy từ root repository; unit tests dùng TypeScript đã cài trong
adminUI. Browser tests chặn/mock các API, không dùng tài khoản hay ghi database thật.
`session-navigation` đếm `/auth/me` và document load khi chuyển danh sách/chi tiết/
chỉnh sửa/thêm mới/tài khoản/dashboard; kiểm tra focus/visibility sau 24 giờ không
gọi thêm `/auth/me`, cập nhật hồ sơ gộp request,
503/403/401 và phản hồi cũ không khôi phục phiên đã bị vô hiệu.
`session-recovery` kiểm tra mở mới/F5, lỗi ban đầu, đăng nhập sai không mở dữ liệu,
đăng nhập đúng không gọi thêm `/auth/me`, và retry không gửi lại thao tác POST.
Backend vẫn xác thực/phân quyền mọi API được bảo vệ, không
thay đổi kiểm soát truy cập để tối ưu UI.

### Sửa trực tiếp bảng Khách hàng và Kho

Nhấp đúp ô/hàng (hoặc focus hàng rồi F2/Enter) để nhập các trường được phép sửa.
Bấm ra ngoài hàng hoặc Enter để tự lưu; Escape hủy. Không có nút Sửa/Lưu/Hủy
trong bảng; link **Chi tiết** và form thêm mới/chi tiết hiện có vẫn giữ nguyên.
Kho có dropdown trạng thái 1 Hoạt động / 2 Tạm ngưng / 0 Đã ẩn; xác nhận trước
khi tạm ngưng/ẩn. Khách hàng không có cột trạng thái trong schema nên không tạo
dropdown giả. Chức năng chỉ bật nếu metadata API cho phép ghi.

PATCH `/api/data/customers` hoặc `/api/data/warehouses` gửi `key` JSON với đúng
kiểu (mã kho là số, gồm cả số âm hợp lệ), chỉ gửi trường đổi và không gửi khóa
chính/generated/immutable/system. Số điện thoại giữ chuỗi, trường tùy chọn trống
lưu null. Cập nhật đúng hàng bằng response; không gọi lại danh sách/metadata/phiên,
không tải lại trang. Lỗi giữ bản nháp/trạng thái cũ để người dùng thử lại; không
tự retry thao tác ghi. Chặn thao tác trùng khi đang lưu; link Chi tiết chờ tự lưu
thành công. Mọi API vẫn kiểm tra quyền tại backend, không cần migration.

> Lưu ý: không cần deploy server để chạy và xem giao diện trên máy cá nhân.

## Cấu trúc source code

```text
ui/adminUI/
├── app/
│   ├── accounts/               # List, new, [id], [id]/edit
│   ├── account/page.tsx        # Tài khoản của admin đang đăng nhập
│   ├── api/backend/[...path]/  # Gateway server tới Python
│   ├── [section]/[id]/
│   │   ├── edit/page.tsx       # Route chỉnh sửa một bản ghi
│   │   └── page.tsx            # Route xem chi tiết một bản ghi
│   ├── detail-view.tsx         # Giao diện trang chi tiết dùng chung
│   ├── globals.css             # Toàn bộ style và responsive
│   ├── layout.tsx              # Root layout và metadata của website
│   └── page.tsx                # Trang gốc, khởi tạo AdminApp
├── src/
│   ├── components/admin/
│   │   ├── admin-app.tsx       # Điều phối trạng thái và màn hình quản trị
│   │   ├── header.tsx          # Header, thông báo và menu tài khoản
│   │   ├── sidebar.tsx         # Logo, sidebar và menu điều hướng
│   │   └── ui.tsx              # Các component UI dùng lại nhiều nơi
│   ├── data/
│   │   └── admin-data.ts       # Cấu hình module, không chứa bản ghi mẫu
│   ├── features/
│   │   ├── accounts/           # API client, types, list/form/detail/profile, CSS
│   │   ├── auth/               # Màn hình đăng nhập
│   │   ├── dashboard/          # Dashboard tổng quan
│   │   ├── details/            # Giao diện chỉnh sửa bản ghi
│   │   ├── forms/              # Form thêm mới dữ liệu
│   │   └── modules/            # Trang danh sách dùng chung cho các module
│   └── types/
│       └── admin.ts            # Kiểu dữ liệu TypeScript dùng chung
├── .gitignore                  # Các file không đưa lên Git
├── next-env.d.ts               # Khai báo kiểu dữ liệu của Next.js
├── package.json                # Thư viện và lệnh npm
├── package-lock.json           # Khóa phiên bản thư viện
└── tsconfig.json               # Cấu hình TypeScript
```

## Cách hoạt động của giao diện

`app/page.tsx` tải component `AdminApp`. Component này quản lý module đang được chọn và kết hợp `Header`, `Sidebar`, dashboard cùng các trang danh sách.

`/accounts` và `/account` dùng `src/features/accounts`, không đọc tài khoản từ
`admin-data.ts`. Header hiển thị tên/tài khoản thật từ `GET /api/auth/me`.
Link tài khoản cũ `/data/accounts?...` được chuyển sang các route mới.

Cấu hình nhãn/menu trong `src/data/admin-data.ts` không chứa bản ghi mẫu. `ModuleView` mở trang tài khoản chuyên biệt hoặc `BackendDataView` để đọc dữ liệu API.

Các liên kết xem chi tiết sử dụng route động:

```text
/{section}/{id}
```

Các liên kết chỉnh sửa sử dụng route:

```text
/{section}/{id}/edit
```

Ví dụ:

```text
/accounts/TK001
/accounts?edit=TK001
```

Riêng tài khoản không còn trang sửa riêng: nhấp đúp hàng (hoặc chọn hàng rồi
nhấn F2/Enter) để hiện ô tên đăng nhập/email ngay trong bảng. Cột Thao tác mặc định
chỉ có **Chi tiết**, không có nút **Sửa/Lưu/Hủy**, kể cả khi đang nhập.
Bấm/chạm ra ngoài hàng hoặc nhấn Enter tự lưu bằng PATCH chỉ các trường đã đổi;
không thay đổi gì thì đóng ô nhập mà không gửi API. Esc bỏ bản nháp. Chuyển giữa
hai ô trong cùng hàng không tự lưu. Hiện trạng thái đang lưu và khóa ô nhập để
không gửi trùng; không tự lặp PATCH. Lỗi kiểm tra dữ liệu/API giữ nguyên ô nhập
và bản nháp để sửa rồi bấm ra ngoài hoặc Enter để thử lại. Link chi tiết chờ lưu
thành công rồi mới điều hướng; nếu lỗi thì giữ nguyên trang để không mất bản nháp.
Lưu thành công chỉ thay hàng bằng dữ liệu API trả về,
không điều hướng, refresh trang hoặc tải lại danh sách. Lỗi giữ nguyên bản nháp
để sửa/thử lại; không tự gửi lại. Chỉ một hàng được sửa mỗi lần; khóa tìm/lọc/
phân trang cho đến khi tự lưu thành công hoặc Esc để tránh mất dữ liệu đang nhập.
Chi tiết vẫn mở trang chi tiết như trước, cùng các chức năng trạng thái/phân quyền/
cấp lại mật khẩu. Nút Chỉnh sửa ở chi tiết mở hàng tương ứng trong bảng. Link cũ
`/accounts/[id]/edit` và `/data/accounts?...&edit=1` chuyển sang editor trong bảng.
Không sửa mã/chủ tài khoản, vai trò hoặc trạng thái qua PATCH thông tin. Cột trạng
thái có dropdown Hoạt động/Tạm khóa/Đã ẩn, lưu ngay qua POST `/admin/accounts/{id}/status`
khi chọn; khóa/ẩn cần xác nhận, mở lại không cần xác nhận. Không cho tự khóa/ẩn:
dropdown của tài khoản đang đăng nhập bị khóa, backend vẫn kiểm tra độc lập.
Chỉ áp dụng response thành công vào đúng hàng, không tải lại danh sách; lỗi giữ
trạng thái cũ và báo tại ô. Trong khi sửa tên/email, dropdown trạng thái bị khóa;
trong khi lưu trạng thái, khóa dropdown/tìm/lọc/phân trang và không mở editor mới
để tránh ghi đè dữ liệu hoặc gửi trùng. Không tự retry POST. Sửa tài
khoản của mình vẫn cập nhật phiên/header bằng sự kiện hồ sơ như trước.

## Các lệnh thường dùng

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Chạy website ở chế độ phát triển |
| `npm run build` | Kiểm tra và tạo bản build production |
| `npm run start` | Chạy bản production sau khi build |
| `npm exec tsc -- --noEmit` | Kiểm tra lỗi TypeScript mà không tạo file |

## Hướng phát triển tiếp theo

- Hoàn thiện các nghiệp vụ còn lại bằng transaction/RPC trước khi nối UI.
- Kiểm thử ghi trên database test riêng trước khi dùng dữ liệu production.
- Bổ sung quên mật khẩu email, audit log và shared rate limiter khi cần.

## Thử luồng tài khoản

1. Đăng nhập ADMIN, mở **Tài khoản** ở sidebar hoặc `/accounts`.
2. Tìm/lọc role và trạng thái. Chọn mã tài khoản → xem chi tiết → **Chỉnh sửa**
   mở trang riêng. Không sửa PK/chủ sở hữu.
3. **Thêm tài khoản**: nhập họ tên, loại tài khoản, username và mật khẩu; chọn kho
   hoạt động nếu là nhân viên kho. Backend tạo mới người và tài khoản trong một
   transaction, không cần chọn hồ sơ cũ hoặc nhập mã tài khoản. Mã được cấp khi lưu:
   ADMIN → `AD000001`, THU_KHO → `KHO000001`, KHACH_HANG → `KH000001` (số tự tăng).
   Username 3–80 ký tự chữ/số/._-; mật khẩu
   10–128 ký tự. Cần cài migration `Backend/migrations/20261010_admin_account_creation.sql`
   trên database của backend trước khi thử lưu; app không tự chạy migration.
4. Thử khóa/ẩn/mở lại trên tài khoản test khác; không được tự khóa mình.
5. Phân quyền chỉ áp dụng cho nhân viên; thủ kho phải có kho hoạt động.
6. Cấp lại mật khẩu sẽ vô hiệu token cũ. Menu header → **Tài khoản của tôi**:
   tự đổi mật khẩu cần mật khẩu hiện tại; thành công trở về đăng nhập.

Đọc [API contract](../../Backend/app/admin_accounts/README.md) để biết giới hạn
phiên, quy tắc và lỗi. Từ root chạy test API/gateway:

```powershell
Backend/.venv/Scripts/python.exe -m pytest Backend/tests -q
node --test ui/shared/tests/backend-route.test.cjs
```

Browser smoke test: chạy admin ở cổng 3000, cài Playwright vào một thư mục công
cụ riêng (`npm.cmd install --prefix C:/temp/phub-browser-tests --no-save playwright`)
và browser (`C:/temp/phub-browser-tests/node_modules/.bin/playwright.cmd install chromium`).
Test dùng mock HTTP trong browser, không cần Supabase và không ghi dữ liệu thật:

```powershell
$env:PHUB_PLAYWRIGHT_MODULE='C:/temp/phub-browser-tests/node_modules/playwright'
$env:PHUB_ADMIN_TEST_URL='http://localhost:3000'
node ui/adminUI/tests/accounts.e2e.cjs
```

Trên Render: `PHUB_API_BASE_URL=https://phub-api.onrender.com`; hai biến
`NEXT_PUBLIC_*` dùng URL kho/khách cloud thực tế. Deploy cả backend và adminUI
sau khi push/merge; code local không tự cập nhật cloud.

## UI local → API Render

Đặt `PHUB_API_BASE_URL=https://phub-api.onrender.com` trong `.env.local` rồi khởi động lại Next.js. Không cần secret Supabase trong UI. Xem yêu cầu Origin, cookie và phiên bản endpoint trong [README gốc](../../README.md).

## Kéo thả/chọn ảnh sản phẩm

Trang thêm/sửa sản phẩm (`/data/products?...`) dùng `ImageEditor` cho trường
`duong_dan_anh`: kéo thả một file hoặc chọn JPG/PNG/WebP, xem trước, gỡ ảnh hay
nhập URL. Chỉ khi bấm **Lưu dữ liệu** mới upload qua
`/api/backend/admin/media/images`; gateway chuyển file nhị phân sang backend.
Đã có URL thì không phải upload lại. Backend kiểm tra quyền/file thật và lưu vào
Supabase Storage, sau đó form lưu URL vào sản phẩm. Không hiển thị thành công
chỉ dựa vào preview local.

Sau khi lưu thành công, form sản phẩm ở nguyên trang và áp dụng bản ghi do API
trả về: chỉ cập nhật ảnh/giá trị đã thay đổi, không remount form, không gọi lại
metadata, `/auth/me` hoặc GET sản phẩm. Có thông báo lưu thành công và link
**Xem chi tiết** nếu muốn rời form. Tạo sản phẩm xong chỉ cập nhật URL hiện tại
sang chỉnh sửa bằng History API; lưu tiếp dùng PATCH đúng mã vừa tạo, không POST
thêm sản phẩm. Nút lưu khóa khi không có thay đổi. Rời form khi request đang chờ
sẽ hủy phần xử lý UI của request đó để response cũ không ghi đè trang mới;
không coi hủy request ở trình duyệt là rollback một thao tác server đã thực hiện.

Lỗi upload giữ form và file đã chọn; lỗi ghi sản phẩm sau khi upload giữ URL để
người dùng thử lưu lại. Không tự lặp POST. Gỡ ảnh chỉ gỡ liên kết khỏi sản phẩm,
không xóa file cũ trên bucket. Hiện schema chỉ có một ảnh cho mỗi sản phẩm.

Backend trên `PHUB_API_BASE_URL` phải được deploy bản có API media; nếu chưa có,
UI báo rõ cần deploy backend mới, không thay bằng ảnh/dữ liệu giả. Cấu hình bucket
public và key server-only xem [Backend README](../../Backend/README.md#upload-ảnh-sản-phẩm-vào-supabase-storage).
Browser test mock, không ghi Storage thật: `node ui/adminUI/tests/media-upload.e2e.cjs`
(từ root, đặt biến môi trường Playwright như phần kiểm thử trên).

Trang chi tiết sản phẩm (trước khi bấm **Chỉnh sửa**) có khung ảnh gọn 340 px bên
trái, thông tin bên phải; mobile xếp dọc. Ảnh căn giữa, giữ tỷ lệ và không cắt.
Nút **Xem ảnh gốc**/bấm ảnh mở dialog ngay trong trang, không mở tab hoặc đổi URL.
Đóng bằng Esc/nút X/bấm backdrop; dialog giữ focus và trả focus khi đóng, khóa
cuộn trang nền trong lúc mở. Có thông báo khi chưa có ảnh/tải lỗi và nút thử lại. URL ảnh
Supabase dùng trực tiếp; ảnh cũ `/images/...` được route chỉ đọc của Admin ánh xạ
sang `https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/...`.
Không cần thư mục ảnh local hoặc chạy customer UI. Route chỉ tải ảnh từ prefix
cố định này, chặn traversal/redirect, không chuyển query/cookie/token, giới hạn
10 MiB và timeout 15 giây. Không sửa URL trong database hay upload lại ảnh.

### Log lỗi ảnh khi chạy local

Chạy `npm run dev`; không cần bật thêm biến môi trường. Lọc `[PHUB:image]`:

- Terminal chạy Admin: `stage: proxy`, URL ảnh trên Storage, HTTP `status` và
  `reason` như `upstream-404`, `upstream-400`, `upstream-timeout`,
  `invalid-content-type` hoặc `image-too-large`.
- F12 → Console: `stage: preview` (chi tiết), `editor` (thêm/sửa) hoặc `viewer`
  (ảnh gốc), kèm URL đã bỏ query/fragment/thông tin đăng nhập. Blob preview chỉ
  ghi `[local-file-preview]`. Trình duyệt không cung cấp HTTP status cho `img.onerror`;
  xem thêm tab Network hoặc log terminal để biết mã lỗi thật.
- Network → request `/images/...` → Response Headers: `X-Phub-Media-Error` cho
  biết lỗi proxy; lỗi không bị cache. 404 là file không tồn tại, 502 là lỗi
  phản hồi/kết nối Storage, 504 là timeout. `reason` giữ mã upstream khi có.

Không ghi cookie, token, API key, request/response body hoặc nội dung exception.
Log chẩn đoán riêng này tắt trong production. Không tự retry ảnh; dùng nút
**Thử tải lại ảnh** hoặc chọn URL/file khác, không tải lại toàn bộ trang.
Kiểm thử route/log offline: `node --test ui/adminUI/tests/image-proxy.test.cjs`.

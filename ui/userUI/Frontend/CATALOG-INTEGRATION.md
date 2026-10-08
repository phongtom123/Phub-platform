# Tích hợp catalog khách hàng

Catalog, chi tiết sản phẩm, tìm kiếm trên header và các khối sản phẩm trang chủ
đã dùng API công khai của FastAPI. Hai layout desktop/mobile dùng cùng dữ liệu;
mốc chuyển layout là 760px. Bản ghi sản phẩm được lấy từ Supabase qua backend,
không sử dụng fixtures làm phương án dự phòng khi API lỗi.

## Phạm vi và luồng dữ liệu

Đợt tích hợp đầu sửa frontend khách hàng trong thư mục này. Đợt sửa bộ lọc
bổ sung API đọc catalog; CORS chung, cấu trúc database, admin UI và warehouse UI
giữ nguyên. Chi tiết: [CUSTOMER-UI-REVIEW.md](../../../CUSTOMER-UI-REVIEW.md).

- Trình duyệt gọi `/api/catalog/*` trên chính origin của Next.js.
- Route Handler `src/app/api/catalog/[...path]/route.ts` chỉ chuyển tiếp GET của
  danh sách, chi tiết, loại sản phẩm, thương hiệu và màu sắc tới FastAPI. Các đường dẫn
  khác bị từ chối. Không chuyển tiếp cookie, token hoặc địa chỉ server từ client.
- `src/lib/catalog/server.ts` dùng `PHUB_API_BASE_URL`, timeout 15 giây, không cache
  và không theo redirect. Chi tiết sản phẩm được đọc ở server qua cùng lớp này.
- `src/lib/catalog/client.ts` kiểm tra phản hồi, chuyển lỗi công khai và tạo query.
- `src/lib/catalog/types.ts` chuyển dữ liệu API sang props của các component UI.
- `useCatalog` quản lý query trong URL và hủy/bỏ qua yêu cầu cũ khi đổi điều kiện.
- `CatalogExperience` và `ResponsiveProductDetail` chọn layout phù hợp. Khi thực
  sự chuyển desktop/mobile, danh sách về trang 1 và giữ điều kiện lọc.

Giá thập phân dạng chuỗi của API được chuyển sang số **chỉ để định dạng hiển thị**
bằng Intl theo tiền tệ API. Không dùng số này để tính đơn hàng hoặc thanh toán.

## Quy tắc giá và thuế đã xác nhận

Giá sản phẩm là giá trước thuế. `Price.tsx` hiển thị dòng đỏ nhỏ
**“chưa áp dụng thuế 10%”** dưới giá; component `TaxNotice` được tái sử dụng ở
thanh mua hàng desktop vốn định dạng giá riêng. Home, catalog grid/list, preview
và chi tiết desktop/mobile đều có ghi chú này. CSS chỉ bổ sung kiểu chữ nhỏ màu đỏ,
giữ bố cục và các giá hiện tại. Không cộng 10% vào giá catalog hoặc tự tạo hóa đơn.

API đặt đơn mới cũng trả tổng trước thuế; thuế áp dụng khi bộ phận hóa đơn lập
hóa đơn. Backend không trừ tồn thực khi tạo đơn; phần kho xử lý khi xuất hàng.
Mô tả code cho cả bốn mục tiêu ở [Backend/README.md](../../../Backend/README.md).
Migration đặt đơn vẫn chờ nhóm triển khai. Mục tiêu 4 đã nối giỏ/checkout/voucher/
đơn/thanh toán; auth thật còn chờ module của thành viên đăng nhập. Xem trạng thái,
file và cách kiểm thử riêng ở [SHOPPING-INTEGRATION.md](SHOPPING-INTEGRATION.md).

## Chạy local

Mở **hai terminal PowerShell riêng**, mỗi terminal bắt đầu tại thư mục gốc
`Phub-platform` (thư mục chứa `Backend` và `ui`). Giữ hai terminal chạy trong
khi sử dụng giao diện.

Terminal 1 — backend:

```powershell
cd .\Backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2 — frontend trên máy Windows hiện tại (SWC native bị chặn):

```powershell
cd .\ui\userUI\Frontend
$env:NEXT_TEST_WASM_DIR=(Resolve-Path 'node_modules/@next/swc-wasm-nodejs').Path
npm.cmd run dev -- --webpack --hostname 127.0.0.1 --port 3001
```

Các thư viện cần thiết và SWC WASM đã có trên máy được kiểm tra. Nếu mới clone
dự án hoặc vừa chạy `npm ci`, xem phần cài SWC WASM bên dưới. Trên máy không chặn
SWC native, có thể dùng `npm.cmd run dev -- --port 3001` như bình thường.

PowerShell của máy hiện tại có Execution Policy `Restricted`. Dùng `npm.cmd`
và gọi thẳng `.venv\Scripts\python.exe` để không phải chạy `npm.ps1` hoặc
`Activate.ps1`; không cần thay Execution Policy hay chính sách Windows.

Mặc định backend ở `http://127.0.0.1:8000`. Nếu dùng địa chỉ khác, tạo `.env.local`
theo `.env.example` và đặt `PHUB_API_BASE_URL`, rồi khởi động lại frontend.
Biến này dùng ở server; **không cần khóa Supabase ở frontend**. Lớp chuyển tiếp
giúp frontend chạy ở cổng 3000 hoặc 3001 mà không đổi CORS backend.

- Trang chủ: `http://localhost:3001/`.
- Swagger backend: `http://127.0.0.1:8000/docs`.
- Catalog: `http://localhost:3001/main/product`.
- List view: `http://localhost:3001/main/product?view=list`.
- Chi tiết: chọn sản phẩm trên trang chủ/catalog để dùng `ma_sp` thực tế.

### Máy Windows chặn SWC native

Trong môi trường kiểm tra hiện tại, Windows Application Control chặn thư viện
SWC native. Không thay chính sách máy; dùng SWC WebAssembly cùng phiên bản Next:

```powershell
npm.cmd install --no-save --package-lock=false --ignore-scripts @next/swc-wasm-nodejs@16.3.6
$env:NEXT_TEST_WASM_DIR=(Resolve-Path 'node_modules/@next/swc-wasm-nodejs').Path
npm.cmd run dev -- --webpack --port 3001
```

Biến đường dẫn chỉ đặt trong terminal hiện tại để Next tìm được binding WASM.
Không được commit thư viện tạm hoặc thay package.json/lockfile. Trong terminal
đó có thể build bằng `npm.cmd run build -- --webpack`; Turbopack cần SWC native.
Sau khi build, chạy `npm.cmd run start -- --port 3001` trong cùng terminal để giữ
`NEXT_TEST_WASM_DIR` khi Next đọc `next.config.ts`.
Máy không gặp giới hạn này dùng các lệnh dev/build thông thường.

### Lỗi khởi động thường gặp

- `Activate.ps1` hoặc `npm.ps1` báo không được chạy script: dùng các lệnh `.exe`
  và `npm.cmd` ở trên, không cần kích hoạt môi trường ảo.
- Không tìm thấy `.venv\Scripts\python.exe`: từ `Backend`, chạy
  `python -m venv .venv`, rồi
  `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`.
- `No module named uvicorn`: cài requirements bằng Python trong `.venv` với
  lệnh trên. `Could not import module app.main`: kiểm tra terminal đang ở `Backend`.
- `Resolve-Path` không tìm thấy thư mục WASM: từ `ui/userUI/Frontend`, chạy lệnh
  cài `@next/swc-wasm-nodejs` ở phần trên rồi đặt lại biến trong terminal đó.
- `EADDRINUSE` hoặc backend báo cổng đã được sử dụng: mở URL để kiểm tra dịch vụ
  đang chạy; dừng terminal chạy dịch vụ cũ bằng Ctrl+C trước khi khởi động lại.
  Không dừng tiến trình của admin/warehouse để giải phóng cổng.
- API trả 503 dù backend đã khởi động: kiểm tra kết nối mạng tới Supabase.
  Nếu báo thiếu cấu hình, kiểm tra `SUPABASE_URL` và `SUPABASE_SECRET_KEY` trong
  `Backend/.env`; không đưa khóa này vào frontend.

`next.config.ts` đã được sửa để dùng một `export default`, giữ nguyên
`allowedDevOrigins`. Trước đó file trộn `module.exports` và `export default`.

## Hành vi UI

- Header tìm tên/SKU; giới hạn nhập 100 ký tự theo API.
- Loại và thương hiệu lấy từ metadata thật. Chọn nhiều loại dùng query lặp
  `category_id`; thương hiệu dùng đúng chuỗi `brand`, không dùng slug/logo.
- URL lưu `q`, `category_id`, `brand`, `min_price`, `max_price`, `color`,
  `stock_status`, `sort`, `page`, `page_size` và `view`.
  Back/Forward và reload khôi phục điều kiện. Không gửi `view` tới backend.
- Desktop giữ grid/list và tùy chọn số sản phẩm/trang. Mobile dùng 12 sản phẩm/trang.
- Bộ lọc giữ trạng thái nháp tới khi áp dụng. Lọc/sắp xếp/đổi số lượng trang đưa
  về trang 1. Tổng/range/số trang lấy từ kết quả backend, không tính theo fixtures.
- Khoảng giá, màu và tồn kho lọc qua API trước phân trang, trên cả desktop/mobile.
  Màu lấy từ thông số có sẵn; thiếu màu có lựa chọn riêng. Tồn khả dụng trừ lượng
  đang giữ bởi đơn chưa xuất kho. Sắp xếp tên chưa có API nên vẫn vô hiệu hóa.
  Badge số lượng từng loại được bỏ vì API chưa cung cấp facet counts.
- Trang chủ lấy một trang 8 sản phẩm đang bán và một trang tối đa 5 sản phẩm cho
  mỗi loại đang hoạt động. Nút "Xem tất cả" mở catalog thật theo loại tương ứng.
  Không gắn nhãn "mới nhất" vì schema chưa có thời gian thêm sản phẩm.
- Xem nhanh và chi tiết dùng tên, SKU, giá, ảnh, mô tả và thông số API. Tab chi
  tiết hiển thị thương hiệu, loại, đơn vị và bảo hành; không gắn nội dung i7/RTX
  mẫu của một model khác vào sản phẩm thật.
- Xem nhanh có hai nút **Xem chi tiết sản phẩm** và **Thêm vào giỏ hàng**, dùng
  chung `ProductPreviewActions` trên trang chủ và catalog.
- URL ảnh công khai được tải trực tiếp, có fallback trung tính khi thiếu/hỏng ảnh.
  Không dùng ảnh sản phẩm khác làm fallback và không mở rộng image-host config.
- Không sinh rating, giảm giá hoặc trạng thái còn hàng khi không có dữ liệu.
- Lỗi danh sách có nút thử lại. Lỗi metadata có thể thử lại riêng mà danh sách
  vẫn hoạt động. Lỗi chi tiết có error boundary; sản phẩm không công khai có
  trang not-found. Không fallback sang fixtures khi lỗi hoặc không tìm thấy.
- Giỏ hàng và checkout đã nối API trong mục tiêu 4; so sánh/yêu thích vẫn là
  state tạm trên UI. Thanh toán đọc giao dịch của đơn, không gọi PayPal hoặc
  thu tiền. Header/menu, banner, nội dung
  dịch vụ và khuyến mãi tĩnh giữ thiết kế hiện có; không suy diễn nhánh menu mẫu
  thành taxonomy thật. Chỉ filter bằng `category_id` có trong metadata.

Supabase hiện có sản phẩm seed/demo và chưa có ảnh. UI đọc đúng dữ liệu đó và
hiện placeholder; cần cập nhật dữ liệu/ảnh ở phần quản trị khi nhóm chuẩn bị
dữ liệu thực tế. Đợt này không chỉnh hoặc ghi bất kỳ bản ghi database nào.

## Kiểm tra

```powershell
node_modules/.bin/tsc.cmd --noEmit --incremental false
npm.cmd run build
```

Lint chạy trên các file tích hợp. Kiểm thử backend tiếp tục chạy bằng
`.venv/Scripts/python.exe -m pytest -q` từ `Backend`.

`scripts/check-catalog.mjs` kiểm tra qua Chrome headless: viewport, dữ liệu thật,
tìm SKU, giá tăng/giảm, lọc kết hợp, nháp bộ lọc, phân trang/Back/Forward/reload,
dialog, detail desktop/mobile, trạng thái rỗng/404, lỗi API/metadata và ảnh hỏng.
Script chỉ đọc và mô phỏng lỗi ở trình duyệt, không sửa dữ liệu Supabase.
Ảnh và báo cáo nằm trong `.next/catalog-check/` (không commit).

Playwright có thể cài trong thư mục tạm, không thêm dependency của dự án:

```powershell
npm.cmd install --prefix "$env:TEMP/phub-catalog-tools" --no-save --package-lock=false --ignore-scripts playwright
$env:PHUB_PLAYWRIGHT_MODULE='file:///' + ($env:TEMP -replace '\\','/') + '/phub-catalog-tools/node_modules/playwright/index.mjs'
node scripts/check-catalog.mjs
```

Mặc định kiểm tra `http://127.0.0.1:3001`; đặt `PHUB_UI_URL` nếu dùng địa chỉ khác.
Cần Chrome đã cài và backend/frontend đang chạy. Phiên bản Playwright được cài
chỉ phục vụ script kiểm tra, không dùng trong runtime ứng dụng.

Lần kiểm tra tích hợp ngày 03/10/2026: TypeScript và lint các file thay đổi đạt;
75 kiểm thử backend và 24 kiểm tra trình duyệt đạt, không có lỗi JavaScript runtime.
Production build bằng Webpack/SWC WASM hoàn tất thành công.
Dữ liệu kiểm tra có 12 sản phẩm công khai; cả 12 chưa có ảnh.

Sau khi bổ sung ghi chú thuế: TypeScript/lint phần thay đổi và 27 kiểm tra trình
duyệt đạt. Script kiểm tra ghi chú đỏ nhỏ trên từng thẻ sản phẩm, preview, Home
và chi tiết desktop/mobile; vẫn kiểm tra tìm kiếm, lọc, phân trang, lỗi và ảnh hỏng.
Số lượng/nội dung sản phẩm có thể thay đổi khi nhóm bổ sung dữ liệu Supabase;
các con số ở lần kiểm tra trước chỉ mô tả dữ liệu tại thời điểm đó.

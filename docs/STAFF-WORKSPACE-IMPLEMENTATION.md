# Chuyển nghiệp vụ admin sang nhân viên

Nhánh tích hợp: `feat/backend-middleware-api`, trong thư mục `BanPC`.
Thư mục review `BanPC-staff-warehouse` vẫn giữ nguyên nhánh cũ.

## Phạm vi quyền

| Nhóm chức năng | ADMIN | NHAN_VIEN |
| --- | --- | --- |
| Tổng quan, báo cáo kinh doanh, báo cáo CRM, kết quả khảo sát | Có | Không |
| Quản lý nhân viên, tài khoản, cấp quyền, cấp lại mật khẩu | Có | Không |
| Đơn hàng, hóa đơn, thu/hoàn tiền, khách hàng | Không | Có |
| Sản phẩm, loại sản phẩm, ảnh, khuyến mãi, voucher | Không | Có |
| Tồn kho, phiếu nhập, nhà cung cấp, kho | Không | Có |
| Hỗ trợ khách, tạo/gửi khảo sát, kiểm duyệt đánh giá | Không | Có |
| Hồ sơ cá nhân, đổi mật khẩu, đăng xuất | Có | Có |

Nhân viên đọc dữ liệu tất cả kho. Nhân viên không có màn hình quản lý nhân viên
hoặc tài khoản và bị chặn POST/PATCH hồ sơ nhân viên. Danh sách tra cứu phục vụ
chứng từ chỉ có mã, họ tên, trạng thái; không trả lương, CCCD hoặc hồ sơ đầy đủ.
Việc quản lý nhân sự và cấp quyền thuộc admin. Trang tài khoản cá nhân vẫn có
đổi mật khẩu cho chính người đang đăng nhập.

Khảo sát dùng chung màn hình danh sách/cấu trúc: admin chỉ đọc và xem kết quả;
nhân viên tạo/sửa/gửi/đóng, không truy cập thống kê. Chuyển kho tiếp tục ngừng sử dụng.

## Tái sử dụng mã

- `ui/shared/internal-access.ts`: khả năng truy cập module và trang chính theo portal.
- `ui/adminUI/src`: một bộ mã giao diện dùng chung, import bằng `@internal/*`
  trong cả hai ứng dụng. Không sao chép toàn bộ tính năng sang một bản thứ hai.
- `ui/warehouseUI/app`: route và layout của nhân viên, dùng chung sidebar,
  header, đăng nhập, bảng, form và các màn hình nghiệp vụ từ bộ mã trên.
- `ui/warehouseUI/src/features/receipts/receipt-list.tsx`: dùng trực tiếp bảng
  `BackendDataView` của admin, không giữ thêm một bộ giao diện danh sách cũ.
  Một nút “Lập phiếu nhập” mở màn hình nghiệp vụ dùng chung, gồm chọn kho,
  sửa giá nhập, tỷ lệ lợi nhuận và thuế. Tìm kiếm, lọc, phân trang, sửa nháp
  bằng nhấp đúp và chi tiết cũng dùng cùng component.
- Các route phiếu nhập cũ `/receipts/new`, `/receipts/[id]` và `/edit` vẫn đọc
  được liên kết trước đó, dùng RPC kho có transaction và version.
- `ui/warehouseUI/src/features/internal`: tồn kho tổng hợp theo SKU và tài khoản
  cá nhân; dùng dữ liệu API, không dựng dữ liệu mẫu khi lỗi.
- Bán tại quầy/liên kết hóa đơn tiếp tục dùng các component nhân viên hiện hữu.
  Thông tin người mua dùng chung `CounterBuyerFields`: hỗ trợ tài khoản theo
  email và khách vãng lai, đều bắt buộc tên + email. Xem [luồng email người mua](COUNTER-BUYER-EMAIL.md).
- `/dispatches`: trang Phiếu xuất theo đơn, lọc các đơn chờ chuẩn bị/chờ xuất/
  đã xuất/hoàn thành rồi mở chi tiết đơn hiện có để xác nhận. Không tạo phiếu
  xuất riêng hoặc luồng trừ tồn thứ hai. Tồn chỉ thay đổi qua transaction xuất
  đơn hiện tại, không thay đổi khi mở trang hoặc tìm kiếm.
- Gateway nhân viên dùng chung `ui/shared/backend-route.ts` với admin, gồm
  đường dẫn nghiệp vụ, ảnh và xác thực. Backend vẫn là `phub_api` ba lớp.

Tên URL `/api/admin/operations`, `/api/admin/media` được giữ tương thích.
Tên URL không quyết định quyền: dependency/service và SQL kiểm tra role hiện tại.
Không nhập backend cũ `Backend/app` hoặc logic xuất hàng/manual invoice chưa an toàn
từ nhánh review sang bản này.

## Chạy local

Backend: từ `Backend`, dùng `.venv\Scripts\python.exe -m uvicorn phub_api.main:app --host 127.0.0.1 --port 8000`.
Hai UI đặt `PHUB_API_BASE_URL=http://127.0.0.1:8000` ở môi trường server.

- Admin: `ui/adminUI`, `npm run dev`, http://localhost:3000.
- Nhân viên: `ui/warehouseUI`, `npm run dev`, http://localhost:3002.
- Swagger: http://localhost:8000/docs.

Các origin local phải nằm trong cấu hình backend. Hai portal dùng URL nhau qua
`NEXT_PUBLIC_ADMIN_URL` / `NEXT_PUBLIC_WAREHOUSE_URL`; chuyển phiên vẫn dùng mã
handoff một lần, không đưa JWT lên URL. Không đặt secret Supabase vào biến public.

Khi build/deploy nhân viên, cần checkout cả `ui/adminUI/src`, CSS admin và
`ui/shared`, vì các nguồn dùng chung nằm ngoài `ui/warehouseUI`. `npm ci` và
`npm run build` vẫn chạy ở thư mục UI tương ứng. Build filter Render phải tính
cả thay đổi trong các đường dẫn dùng chung này.

`warehouseUI` có bước `prebuild` chạy `npm ci` cho `adminUI` theo lockfile trước
khi biên dịch. Các file dùng chung import `lucide-react`, React và Next từ cây
dependency của admin; chỉ cài `warehouseUI/node_modules` trên môi trường sạch
sẽ báo `Module not found: Can't resolve 'lucide-react'`. Lệnh `npm run build`
tự chạy bước này; không gọi `next build` trực tiếp trên Render.

## Database và triển khai

Migration mới: `Backend/migrations/20261106142849_staff_operational_workspace.sql`.
Migration sửa guard và phạm vi đọc của RPC, không xóa bảng, chứng từ hoặc tồn kho.
Giữ transaction, snapshot giá, version, idempotency và ownership khách hàng.
Phiếu đã có được cập nhật vào chính kho trên phiếu, không chuyển sang kho gán
cho nhân viên; phiếu tạo qua API kho cũ vẫn dùng kho gán, còn API nghiệp vụ
dùng chung hỗ trợ chọn kho như giao diện admin trước đó.

**Đã áp migration phân quyền lên Supabase Phub ngày 07/11/2026 theo yêu cầu người dùng.**
Lịch sử remote ghi tên `staff_operational_workspace`, version `20261107160713`
do công cụ migration cấp; nội dung từ file `20261106142849_staff_operational_workspace.sql`.
Không chạy lại migration này chỉ vì timestamp local/remote khác nhau.
Đã đối chiếu nguồn các hàm trước khi áp và lưu bản sao định nghĩa/quyền cũ ở máy local.
Kiểm tra bằng service_role và actor nhân viên thật: đọc khảo sát thành công
(hiện 0 khảo sát); sản phẩm SP001 trả 1 đánh giá, tất cả dòng khớp sản phẩm.
Nhân viên vẫn bị chặn báo cáo CRM, admin vẫn xem được báo cáo; anon/authenticated
không được gọi trực tiếp các hàm nội bộ. Kiểm tra chỉ đọc, không tạo khảo sát,
không sửa đánh giá, đơn, thanh toán hoặc tồn kho.

Migration email người mua `20261107030114_counter_buyer_email.sql` vẫn chưa áp;
chạy sau migration phân quyền trên khi triển khai chức năng bán tại quầy.
PR #121 đã merge vào main; trạng thái deploy Render cần kiểm tra riêng.

Triển khai cần có cửa sổ cập nhật phối hợp: lưu phiên bản đang chạy, áp migration
sau các migration tiền nhiệm trên main, cập nhật backend cùng hai UI của nhánh này,
rồi kiểm tra cả hai role. Không áp migration trước và để backend/UI Render cũ
tiếp tục vận hành lâu vì quyền cũ sẽ không còn khớp. Migration kiểm tra nguồn hàm
trước khi sửa; nếu lệch schema thì rollback thay vì ghi đè logic không rõ nguồn.

## Kết quả kiểm tra

- Backend: 1.363 test pytest qua; dữ liệu mock/fixtures, không ghi Supabase thật.
- TypeScript admin và nhân viên: qua; production build cả hai UI qua.
- Trình duyệt Chrome với API fixture: 12 đường dẫn nhân viên và 5 đường dẫn admin,
  không có runtime error; kiểm tra menu và chặn trang không thuộc role.
- PostgreSQL biệt lập bằng PGlite: chạy chuỗi migration và guard mới; nhân viên
  gán kho 1 sửa/xác nhận phiếu kho 2, replay không cộng tồn lần hai; kiểm tra
  báo cáo, CRM và quyền gọi hàm của anon/authenticated.
- Các kết quả trên không thay thế kiểm thử nghiệp vụ với dữ liệu thật sau khi
  migration và backend/UI được triển khai đồng bộ.

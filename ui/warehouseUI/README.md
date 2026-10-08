# PHUB Warehouse UI

Prototype giao diện nghiệp vụ thủ kho, được tổ chức theo cấu trúc của nhánh `adminUI`.

## Chạy trên máy

Yêu cầu Node.js 20 trở lên và npm 10 trở lên.

```bash
npm install
npm run dev
```

Mở `http://localhost:3002` để xem giao diện. Dự án Next.js không chạy bằng Live Server.

## Cấu trúc

```text
app/
  [section]/[id]/edit/page.tsx  # Chỉnh sửa bản ghi
  [section]/[id]/page.tsx       # Chi tiết bản ghi hoặc tạo phiếu
  [section]/page.tsx            # Danh sách module
  globals.css                   # Giao diện và responsive
  layout.tsx                    # Root layout và metadata
  page.tsx                      # Màn hình chính
src/
  components/warehouse/         # App, sidebar, header và UI dùng chung
  data/warehouse-data.ts        # Cấu hình module, không có bản ghi mẫu
  features/dashboard/           # Tổng quan kho
  features/details/             # Chi tiết/chỉnh sửa bản ghi
  features/forms/               # Tạo phiếu nhập, chuyển kho, kiểm kê
  features/modules/             # Danh sách tồn kho và nghiệp vụ
  types/warehouse.ts            # Kiểu dữ liệu dùng chung
```

Ngoài các nghiệp vụ kho, sidebar có trang **Tài khoản** (hồ sơ và phân công của thủ kho) và **Cài đặt** (kho mặc định, cảnh báo tồn và thông báo).

Danh sách, dashboard và hồ sơ đọc API. Tạo/xác nhận chứng từ, cài đặt và thông báo chưa tích hợp đầy đủ: hiển thị trạng thái chưa khả dụng, không tạo dữ liệu hay báo thành công giả.

## UI local → API Render

Đặt `PHUB_API_BASE_URL=https://phub-api.onrender.com` trong `.env.local` rồi khởi động lại Next.js. Không cần secret Supabase trong UI. Xem yêu cầu Origin, cookie và phiên bản endpoint trong [README gốc](../../README.md).

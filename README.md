# PHUB Warehouse UI

Prototype giao diện nghiệp vụ thủ kho

## Chạy trên máy

Yêu cầu Node.js 20 trở lên và npm 10 trở lên.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000` để xem giao diện. Dự án Next.js không chạy bằng Live Server.

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
  data/warehouse-data.ts        # Module và dữ liệu mẫu
  features/dashboard/           # Tổng quan kho
  features/details/             # Chi tiết/chỉnh sửa bản ghi
  features/forms/               # Tạo phiếu nhập, chuyển kho, kiểm kê
  features/modules/             # Danh sách tồn kho và nghiệp vụ
  types/warehouse.ts            # Kiểu dữ liệu dùng chung
```

Ngoài các nghiệp vụ kho, sidebar có trang **Tài khoản** (hồ sơ và phân công của thủ kho) và **Cài đặt** (kho mặc định, cảnh báo tồn và thông báo).

Các màn hình hiện dùng dữ liệu mẫu trong source, chưa kết nối API hoặc cơ sở dữ liệu.

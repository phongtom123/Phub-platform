# PHUB · Giao diện kho vận

Ứng dụng dành cho thủ kho tại kho trung tâm PHUB. Màn hình tập trung vào việc theo dõi lượng hàng, xử lý nhập, xuất và chuyển kho, cùng các công việc đang chờ.

## Màn hình

- **Tổng quan:** số lượng SKU, tồn kho, giao dịch mới và việc chờ xử lý.
- **Tồn kho:** tra cứu số lượng theo mã hàng, vị trí và trạng thái còn/hết hàng.
- **Phiếu nhập:** lập phiếu và theo dõi xác nhận hàng nhận.
- **Phiếu xuất:** đối chiếu đơn hàng, soạn hàng và xác nhận xuất kho.
- **Chuyển kho:** theo dõi kho gửi, kho nhận và trạng thái bàn giao.
- **Tài khoản:** hồ sơ, vai trò và kho được phân công.
- **Cài đặt:** kho mặc định và tùy chọn thông báo.

## Khởi chạy

Cần Node.js 20+ và npm 10+.

```bash
npm install
npm run dev
```

Mở URL được in trong terminal, thường là `http://localhost:3000`. Nếu cổng 3000 đang được dùng, Next.js sẽ chọn cổng kế tiếp, ví dụ `http://localhost:3001`.

## Mã nguồn

`app/` chứa route Next.js và style chung. `src/features/` chứa các màn hình nghiệp vụ; `src/components/warehouse/` chứa sidebar, header và khung ứng dụng; `src/data/warehouse-data.ts` chứa dữ liệu demo; `src/types/warehouse.ts` khai báo kiểu dữ liệu.

Đây là prototype frontend. Dữ liệu phiếu, tài khoản và cài đặt hiện là dữ liệu mẫu, chưa lưu vào server hoặc cơ sở dữ liệu.

# Kiểm tra luồng sau đợt nhập kho 1 — 03/11/2026

Kết quả: chưa phát hiện lỗi chặn trong phạm vi dưới đây. Tách kiểm tra dữ liệu
Supabase đang chạy, kiểm tra giao diện/API local, và kiểm thử bằng fixtures.

## Dữ liệu đang chạy — chỉ đọc

- Script `verify_catalog_warehouse1.py` xác nhận 24 SKU, 675 đơn vị, mỗi SKU
  10–50, chỉ có tồn ở kho 1. Giá nhập, giá bán, tỷ lệ định giá và thuế khớp.
- Phiếu 900007/900008/900009 đều `DA_NHAP`, kho 1, đúng ba NCC hiện có; số dòng
  lần lượt 12/3/9, số lượng 315/90/270. Lịch sử có 24 sự kiện tương ứng.
- SP088/SP091 vẫn ẩn, SP089/SP090 vẫn hoạt động với tồn 0. Không thay đổi các
  mẫu này để phục vụ kiểm thử. Không có dòng đơn hàng thật cho SP092–SP115.

## API và giao diện local — dữ liệu thật, không ghi nghiệp vụ

- Admin đăng nhập qua API và qua gateway Next.js tại localhost:3000 thành công.
- API admin đọc đúng ba phiếu, các dòng hàng, snapshot định giá đã xác nhận và
  tồn của cả 24 SKU. Browser mở được cả ba trang chi tiết phiếu, chi tiết tồn
  `[1,"COR-CASE-3000D-AIRFLOW-BLK"]` và sản phẩm SP092; không có lỗi JavaScript
  hoặc phản hồi API 5xx trong lượt kiểm tra này.
- API catalog thấy đủ tám nhóm có hàng; API khả dụng trả đúng 24 SKU/tổng 675.
  Browser khách đã kiểm tra SP092/SP107 có ảnh, số lượng 10/40 và nút mua.
- Script browser admin chỉ cho phép GET và POST đăng nhập; chặn mọi request
  ghi nghiệp vụ khác. Không tạo đơn, thu tiền hoặc thay đổi tồn Supabase thật.
- Cổng admin được mở tại localhost:3000, dùng API local localhost:8000. User UI
  chạy tại localhost:3001. Không kiểm tra hoặc deploy lại Render trong lượt này.

## Kiểm thử bằng dữ liệu biệt lập

- **481 kiểm thử pytest đạt**: catalog, filter/facets, khả dụng, commerce,
  định giá, kho, admin operations, đơn hàng, thanh toán và gallery. HTTP thật
  bị chặn bởi fixture backend, không dùng credentials Supabase.
- `test_catalog_receiving_flow.cjs` chạy đúng SQL batch trên PostgreSQL WASM
  PGlite trong RAM: tạo loại/sản phẩm, nhập 675 qua ba phiếu kho 1, kiểm tra giá,
  ảnh metadata, giữ nguyên dữ liệu cũ; chạy lại không cộng tồn hoặc tạo phiếu.
- Cùng database biệt lập: báo giá không ghi đơn/hóa đơn hoặc giữ hàng; đặt hai
  chiếc tạo một đơn và một hóa đơn tự động, chỉ dùng kho 1 có hàng, giữ tồn khả
  dụng nhưng chưa trừ tồn vật lý; VAT đúng, không tạo thanh toán giả, retry không
  trùng và yêu cầu vượt số còn lại bị từ chối. Chạy lại batch sau đơn không reset
  tồn hoặc phần hàng đang giữ.
- `test_simplified_receipt_pricing.cjs` đạt các kiểm tra xác nhận phiếu, phiên bản
  giá cũ, rollback, retry và quyền nhân viên. `test_stock_commitment.cjs` đạt kiểm
  tra chỉ giữ hàng khi có hóa đơn/khoản thu thành công, hủy giải phóng hàng,
  xuất kho chuyển hàng giữ thành giảm tồn vật lý đúng một lần.
- Browser fixtures `cart-stock.e2e.cjs`, `product-card-actions.e2e.cjs`,
  `product-quantity.e2e.cjs` đạt: tổng tồn các kho, giới hạn số lượng, trừ hàng
  đã có trong giỏ, VAT, hết hàng/tạm ngừng, lỗi API, thay đổi tồn, desktop/mobile.
  Các script này không ghi đơn hoặc tồn trên Supabase thật.

## Thay đổi mã trong lượt kiểm tra

- Thêm hai script kiểm tra SQL biệt lập và browser admin để có thể chạy lại.
- Sửa loader migration trong `test_stock_commitment.cjs` chuẩn hóa CRLF thành
  LF trên Windows. Lỗi so khớp văn bản migration ban đầu nằm trong đường nạp
  fixture này; không thay nội dung migration, logic sản xuất hoặc schema DB.
- Chưa push Git. Kiểm thử biệt lập không thay thế kiểm thử tải nhiều người dùng
  hoặc xác nhận thanh toán qua cổng thanh toán thực tế.

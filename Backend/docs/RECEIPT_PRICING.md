# Định giá trên phiếu nhập

## Dữ liệu lưu

Sau migration `20261030151651_simplify_receipt_pricing.sql`, mỗi dòng
`CT_PHIEU_NHAP` chỉ có sáu cột:

- `ma_phieu_nhap`, `sku`: khóa của dòng.
- `so_luong_nhap`, `gia_nhap`: số lượng và đơn giá nhập.
- `ty_le_loi_nhuan`: tỷ lệ cộng lãi đã chọn cho dòng.
- `thue_snapshot`: mảng mã, tên và tỷ lệ thuế; không chứa số tiền.

Tỷ lệ và tên thuế nằm trên phiếu để phiếu cũ không đổi khi người dùng nhập
thuế khác cho phiếu mới. Phiếu cũ chưa từng lưu các đầu vào định giá vẫn trả
`pricing: null`; hệ thống không suy đoán lịch sử.

Không còn bảng `THUE`, `SAN_PHAM_THUE`, `admin_ops.pricing_defaults`,
`admin_ops.pricing_audit` hoặc cấu hình markup/thuế trên sản phẩm.
Không tự áp markup 20% hay VAT 10%. Dòng mới bắt đầu với markup 0%, không thuế;
ADMIN nhập tỷ lệ và tên thuế trực tiếp trên phiếu. Nhân viên kho chỉ dùng các
đầu vào đã lưu, không được ghi đè tỷ lệ.

`PHIEU_NHAP.dinh_gia_da_ap_dung` vẫn giữ để phân biệt xác nhận theo luồng
định giá với xác nhận cũ chỉ cộng tồn. Các trường người lập, người cập nhật,
người xác nhận của phiếu và nhật ký nghiệp vụ/tồn kho hiện có vẫn giữ.

## Giá trị tính khi đọc

Backend dùng Decimal; PostgreSQL dùng numeric. Làm tròn HALF_UP đến đồng:

```text
lãi = round(giá nhập × tỷ lệ lợi nhuận / 100)
giá trước thuế = round(giá nhập + lãi)
tiền thuế từng loại = round(giá trước thuế × tỷ lệ thuế / 100)
tổng thuế = tổng tiền thuế từng loại
giá sau thuế = giá trước thuế + tổng thuế
```

Các kết quả trên được API tính và trả cho giao diện, không lưu thành cột.
Ví dụ giá nhập 1.000.000, markup 20%, thuế 10% và 2% cho giá sau thuế
1.344.000 đồng. Không tính thuế chồng thuế.

## API và quyền

- `GET /api/pricing/config?sku=...`: ngữ cảnh đọc tương thích; không có
  danh mục/cấu hình toàn hệ thống, trả markup 0 và danh sách thuế rỗng.
- `POST /api/pricing/preview`: nhận `sku`, `unit_cost`, tùy chọn
  `markup_rate`, `taxes: [{code, name, rate}]`, `receipt_id`.
- `GET /api/pricing/receipts/{id}`: tính từ đầu vào từng dòng, trả version
  để phát hiện thay đổi trước khi xác nhận.
- `PUT /api/pricing/config`, `POST /api/pricing/taxes`,
  `PATCH /api/pricing/taxes/{code}`: endpoint cũ đã bỏ; trả 410.
  Giao diện mới không gọi các endpoint ghi này.

ADMIN ghi đầu vào qua API phiếu nhập hiện có. Không gửi các số tiền đã tính.
Nhân viên kho không được gửi override markup/thuế. Tối đa 20 thuế mỗi dòng,
mã không trùng, tỷ lệ từ 0–100%. Tiền/tỷ lệ gửi bằng chuỗi decimal.

Xác nhận vẫn kiểm tra quyền, version, Idempotency-Key và cập nhật tồn kho
trong cùng transaction. Xác nhận luồng mới cập nhật
`SAN_PHAM.gia_ban_hien_tai` theo giá bán trước thuế đã tính; người dùng
xem và xác nhận thay đổi trước khi ghi. Nháp/hủy không cập nhật giá bán.
Phiếu đã nhập/hủy không được sửa đầu vào định giá.

## Triển khai và kiểm tra

Áp migration mới sau `receipt_sale_pricing` và `fixed_operating_warehouse`.
Không sửa hoặc chạy lại các migration cũ. Migration chuyển dữ liệu thuế đang
có thành đầu vào mã/tên/tỷ lệ trước khi bỏ cột, không sửa giá nhập, số lượng,
giá bán hiện tại, tồn kho hoặc trạng thái phiếu.

Deploy backend và Admin/Kho UI cùng thay đổi này để dùng nhập thuế trực tiếp.
Code cũ vẫn đọc được ngữ cảnh và giá tính toán qua các RPC tương thích,
nhưng phần sửa danh mục/cấu hình cũ bị từ chối rõ ràng.

Kiểm tra cục bộ, không ghi dữ liệu cloud:

- `python -m pytest tests/test_pricing.py -q`
- `node scripts/test_simplified_receipt_pricing.cjs`
  (cần `@electric-sql/pglite` hoặc đặt `PHUB_PGLITE_MODULE`).

Kiểm thử SQL kiểm tra cả nâng cấp dữ liệu cũ, kết quả tính lại không đổi,
nhập/xác nhận/hủy, chống ghi hai lần, version cũ, quyền nhân viên và các bảng/
cột đã bỏ. Thuế checkout/hóa đơn vẫn là luồng riêng; không xóa các giá trị
kế toán của hóa đơn bán hàng trong thay đổi này.

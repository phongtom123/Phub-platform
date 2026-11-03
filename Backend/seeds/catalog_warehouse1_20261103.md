# Bổ sung catalog và nhập riêng kho 1 — 03/11/2026

Người dùng yêu cầu thêm loại/sản phẩm, mỗi SKU 10–50 đơn vị, có phiếu nhập từ
nhà cung cấp tương ứng và chỉ ghi tăng kho 1. Đợt này thêm **24 SKU, 675 đơn vị**,
mã sản phẩm **SP092–SP115**. Các mẫu đều hoạt động, có ảnh chính trong Supabase
Storage và thông số lấy từ nguồn hãng ghi trong manifest JSON.

## Nhóm hàng

| Nhóm | SKU mới | Số đơn vị nhập |
| --- | ---: | ---: |
| Vỏ máy tính | 3 | 45 |
| Tản nhiệt khí | 3 | 90 |
| Tản nhiệt nước AIO | 3 | 135 |
| Quạt tản nhiệt case | 3 | 45 |
| Ổ cứng HDD | 3 | 90 |
| Webcam | 3 | 135 |
| Loa máy tính | 3 | 45 |
| Hub USB | 3 | 90 |

Tạo sáu loại con: `COMPONENT_COOLING_LIQUID`, `COMPONENT_FAN`, `COMPONENT_HDD`,
`ACCESSORY_WEBCAM`, `ACCESSORY_SPEAKER`, `ACCESSORY_USB_HUB`. Hai loại vỏ máy và
tản nhiệt khí đã có từ đợt trước nên được tái sử dụng. Không đổi nhóm lớn hoặc
trạng thái các sản phẩm cũ, gồm bốn mẫu hết hàng/ẩn SP088–SP091.

## Phiếu nhập đã xác nhận

| Mã phiếu | NCC đang có | SKU | Số lượng | Tiền nhập trước thuế |
| --- | --- | ---: | ---: | ---: |
| 900007 | [SEED] Nhà cung cấp 1 | 12 | 315 | 232.450.000đ |
| 900008 | [SEED] Nhà cung cấp 2 | 3 | 90 | 100.750.000đ |
| 900009 | [SEED] Nhà cung cấp 3 | 9 | 270 | 186.500.000đ |

Cả ba phiếu thuộc **kho 1**, trạng thái `DA_NHAP`, đã áp dụng định giá. Dùng lại
ba NCC hoạt động sẵn có; không cần tạo thêm NCC. Giá nhập là giá cấu hình cho
dữ liệu bổ sung theo yêu cầu, không phải báo giá hay hợp đồng thương mại thực tế.
Mỗi dòng phiếu lưu tỷ lệ cộng trên giá nhập 25%, VAT 10%; giá bán trước thuế
được transaction định giá cập nhật từ các đầu vào này. Các chính sách bảo hành
chưa xác định tiếp tục dùng mặc định 0 tháng, không tự dựng cam kết của hãng.

## Cách ghi và kiểm chứng

- SQL chạy cùng transaction cho sản phẩm, loại con, tạo phiếu và xác nhận phiếu.
  Gọi `priced_receipt_v1` và `receipt_pricing_preview_v1` hiện có; không INSERT
  hoặc UPDATE trực tiếp vào tồn kho để thay cho nghiệp vụ nhập hàng.
- Mỗi phiếu có khóa idempotency v4 lưu trong manifest. Chạy lại batch đã hoàn
  thành sẽ dừng trước bước tạo hoặc cộng tồn, không nhập lần hai. Batch trùng
  một phần hoặc SKU có sẵn ngoài batch sẽ bị từ chối.
- Transaction đối chiếu đúng từng SKU: số lượng nhập = tồn tại kho 1, giá nhập
  khớp manifest, có đúng một sự kiện lịch sử từ 0 lên số lượng đã nhập.
- Đối chiếu fingerprint xác nhận toàn bộ tồn cũ, tồn ở kho khác, sản phẩm cũ,
  phiếu nhập cũ và dòng phiếu cũ giữ nguyên; lỗi thì rollback toàn bộ batch.
- Sau commit, đọc lại Supabase xác nhận 24 dòng tồn ở kho 1, 24 dòng phiếu nhập,
  24 ảnh chính và 24 sự kiện lịch sử. API tồn khả dụng trả đúng tổng 675; cả tám
  nhóm có ít nhất ba sản phẩm. Kiểm tra trình duyệt SP092/SP107 tải ảnh, hiển thị
  số lượng và có nút mua; không thực hiện đặt hàng hay thanh toán để kiểm thử.

[Danh sách đầy đủ và giá trong CSV](catalog_warehouse1_20261103.csv),
[manifest nguồn](catalog_warehouse1_20261103.json),
[SQL nhập dữ liệu](catalog_warehouse1_20261103.sql).

Kiểm tra lại chỉ đọc và xuất lại CSV (đối chiếu tồn ngay sau đợt nhập; có thể
báo chênh lệch nếu sau này đã bán/điều chỉnh hàng):

```powershell
cd Backend
.\.venv\Scripts\python.exe scripts/verify_catalog_warehouse1.py
```

Đây là thay đổi dữ liệu trên Supabase, không cần deploy lại để đọc bản ghi mới.
Mã local chưa được push hoặc tự deploy trong đợt này.

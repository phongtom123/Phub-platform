# Định giá bán từ phiếu nhập

## Quy ước

- `R` là tỷ lệ cộng lãi (markup), khác biên lợi nhuận trên giá bán. Mặc định hệ thống: **20%**, thuế ban đầu VAT **10%**. Đây là cấu hình ứng dụng, ADMIN phải chọn mức thuế phù hợp sản phẩm.
- Sản phẩm có thể dùng cấu hình riêng hoặc kế thừa hệ thống. Danh sách thuế riêng rỗng nghĩa là không áp dụng thuế; `null` nghĩa là kế thừa.
- `SAN_PHAM.gia_ban_hien_tai` tiếp tục lưu **giá trước thuế**. Giá sau thuế lưu trong snapshot chi tiết phiếu nhập. Thay đổi cấu hình không tự đổi giá đang bán.
- ADMIN sửa markup, thêm/bỏ loại thuế và sửa tỷ lệ cho từng dòng nháp. Nhân viên kho (role hiện tại `NHAN_VIEN`) chỉ xem và dùng cấu hình đã duyệt; backend và database cùng kiểm tra quyền/phạm vi kho.

## Công thức và làm tròn

Backend dùng `Decimal`, PostgreSQL dùng `numeric`. UI gửi tiền/tỷ lệ dạng chuỗi decimal, chỉ hiển thị kết quả API, không tự tính giá dự kiến. Giá nhập tối đa 16 chữ số nguyên, 2 chữ số thập phân; markup tối đa 8 chữ số nguyên, 4 chữ số thập phân; từng thuế từ 0 đến 100%, tối đa 4 chữ số thập phân. Tối đa 20 loại thuế, không trùng mã.

Làm tròn **HALF_UP đến 1 đồng** ở mỗi bước, với đầu vào không âm:

```text
lãi             = round(G × R / 100)
giá trước thuế  = round(G + lãi)
thuế loại i     = round(giá trước thuế × Ti / 100)
tổng thuế       = tổng từng khoản thuế đã làm tròn
giá sau thuế    = giá trước thuế + tổng thuế
```

Không tính thuế chồng lên thuế. `G=1.000.000`, `R=20`, VAT 10% và thuế khác 2% cho kết quả `200.000 / 1.200.000 / 120.000 + 24.000 / 1.344.000đ`.

Markup kiểm tra lại `(giá trước thuế-G)/G×100`; biên tham khảo `(giá trước thuế-G)/giá trước thuế×100`. API trả `null` nếu mẫu số bằng 0, không gán tỷ lệ giả. Sau làm tròn, markup kiểm tra lại có thể lệch nhẹ so với đầu vào.

## API

Các endpoint dùng phiên đăng nhập, không cache. API ghi/preview yêu cầu Origin tin cậy như các API khác.

| Endpoint | Quyền / mục đích |
| --- | --- |
| `GET /api/pricing/config?sku=...` | ADMIN/KHO đọc cấu hình hiệu lực, danh mục, version và 20 thay đổi cấu hình gần nhất; bỏ sku để đọc hệ thống |
| `PUT /api/pricing/config?sku=...` | ADMIN lưu `{markup_rate, taxes, expected_version}`; xung đột version trả 409 |
| `POST /api/pricing/preview` | `{sku, unit_cost, markup_rate?, taxes?, receipt_id?}`; KHO không được gửi override; receipt_id lấy tỷ lệ đã lưu cho dòng nháp |
| `POST /api/pricing/taxes` | ADMIN tạo `{code, name, rate}` |
| `PATCH /api/pricing/taxes/{code}` | ADMIN sửa `{name, rate}` mặc định danh mục; không viết lại tỷ lệ đã chọn ở cấu hình/snapshot |
| `GET /api/pricing/receipts/{id}` | Preview toàn phiếu và `version` trước xác nhận; phiếu đã xử lý chỉ đọc snapshot |

`taxes` gửi vào chỉ gồm `{code, rate}`; không nhận số tiền/tên thuế do frontend tính. Đổi tên thuế danh mục không sửa tên đã lưu trên phiếu xác nhận.

Luồng ghi phiếu vẫn dùng `/api/admin/operations/receipts` hoặc `/api/warehouse/receipts`. Khi xác nhận phải gửi thêm `pricing_version` lấy từ preview toàn phiếu, giữ `expected_version` của KHO / kiểm tra trạng thái của ADMIN và `Idempotency-Key` UUID v4. Cùng key và cùng payload trả kết quả cũ; cùng key nhưng payload khác trả 409.

## Tính nhất quán và lịch sử

RPC `priced_receipt_v1` bao bọc nghiệp vụ tồn kho hiện có trong cùng transaction: khóa cấu hình, phiếu, sản phẩm, thuế; kiểm tra preview; tính lại numeric; chuyển `NHAP → DA_NHAP`; cập nhật tồn kho và giá trước thuế; lưu audit. Lỗi ở bất kỳ bước nào rollback toàn bộ. Phiếu `NHAP` hoặc `HUY` không cập nhật giá đang bán.

Snapshot gồm giá nhập, markup, danh sách thuế/tên/tỷ lệ/từng tiền thuế, tiền lãi, giá trước/sau thuế, người sửa và thời điểm sửa. Phiếu đã nhập/hủy không sửa snapshot; đổi cấu hình sau này không viết lại lịch sử. Audit ở `admin_ops.pricing_audit` ghi cấu hình hệ thống/sản phẩm/thuế, dòng phiếu và thay đổi giá bán. Bảng mới bật RLS, không cấp quyền trực tiếp cho `anon`/`authenticated`; API backend dùng service role.

Phiếu cũ có snapshot `NULL` sẽ hiện chưa có lịch sử, không suy đoán từ cấu hình mới. `PHIEU_NHAP.dinh_gia_da_ap_dung` phân biệt phiếu đã qua luồng cập nhật giá mới. Backend cũ vẫn nhập tồn theo luồng cũ trong thời gian rollout và không tự cập nhật giá bán; cần deploy backend mới để dùng đủ chức năng.

## Triển khai

1. Áp dụng migration nâng cấp `Backend/migrations/20261030023519_receipt_sale_pricing.sql`, sau các migration `admin_operations` và `warehouse_receipts`. **Không chạy lại initial schema** trên database có dữ liệu.
2. Deploy backend và Admin/Kho UI cùng phiên bản. Migration không tự sửa giá bán hiện tại hoặc backfill lịch sử phiếu đã xác nhận.
3. Kiểm tra preview, quyền và xác nhận trên môi trường thử nghiệm trước khi nhập hàng thật. Không dùng phiếu nhập thật để thử idempotency.

Migration đã áp dụng trên Supabase **Phub** ngày 30/10/2026. Truy vấn chỉ đọc trên database thật cho kết quả mẫu 1.344.000đ; đối chiếu trước/sau giữ nguyên giá của 87 sản phẩm và trạng thái 5 phiếu hiện có, không tạo phiếu thử thật. Các RPC mới chỉ cấp `EXECUTE` cho service role. Advisor báo [RLS bật nhưng không có policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) ở các bảng mới vì chúng cố ý chỉ dùng qua backend service role; không mở policy trực tiếp cho trình duyệt.

Phạm vi này là định giá bán dự kiến khi nhập hàng. Thuế checkout/hóa đơn bán hàng hiện có là luồng riêng; chưa chuyển toàn bộ luồng bán hàng sang nhiều loại thuế của sản phẩm. Giá sau thuế trên phiếu nhập không phải cam kết tổng tiền checkout. Các cảnh báo thiếu lịch sử giá vốn hoặc hoàn tiền chưa phân bổ ở báo cáo kinh doanh không tự mất nhờ migration này.

## Kiểm tra giới hạn

- `tests/test_pricing.py`: công thức Decimal, 0%, làm tròn, dữ liệu giả mạo và quyền override.
- `scripts/test_receipt_pricing.cjs`: PostgreSQL cục bộ qua PGlite, không kết nối Supabase; kiểm tra công thức, snapshot bất biến, nháp/hủy, ADMIN/KHO xác nhận, rollback preview cũ và replay không cộng tồn/giá hai lần.
- `ui/adminUI/tests/receipt-pricing.e2e.cjs`: API giả lập, UI chỉ dùng kết quả API, không báo thành công khi backend lỗi và retry giữ key/payload.

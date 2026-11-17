# Voucher theo loại sản phẩm

Ngày cập nhật: 17/11/2026.

## Quy tắc

| Phạm vi | VOUCHER.ma_loai_sp_ap_dung |
| --- | --- |
| Tất cả sản phẩm | NULL |
| Linh kiện máy tính | L_LINHKIEN |
| Máy tính để bàn & PC Gaming | L_DESKTOP |

Chọn phạm vi khi tạo/sửa voucher tại cổng nhân viên. Có thể sửa ngay trên
bảng bằng double click. Voucher cũ mặc định áp dụng tất cả sản phẩm.

Vẫn chỉ dùng một mã cho một đơn. Giảm trước VAT, không đổi giới hạn lượt,
thời gian hiệu lực hoặc chính sách voucher đã dùng khi hủy đơn.

Mức tối thiểu, phần trăm và giới hạn giảm đều xét trên sản phẩm phù hợp.
Ví dụ giỏ gồm linh kiện 2 triệu và PC 10 triệu: voucher linh kiện 10% giảm
200.000đ; nếu yêu cầu tối thiểu 3 triệu thì chưa được áp dụng. Voucher PC
chỉ giảm phần PC, còn voucher toàn bộ giảm trên cả giỏ.

## Database và API

Migration: `Backend/migrations/20261117134210_voucher_product_categories.sql`
và `Backend/migrations/20261117140011_voucher_fulfillment_scope.sql`.
Thêm cột nullable, khóa ngoại đến LOAI_SP và CHECK chỉ nhận hai mã trên.
Không sửa đơn, hóa đơn, tồn kho hoặc số tiền lịch sử.

Hàm nội bộ `customer_order_private.voucher_category_scope_v1` tính phạm vi và
phân bổ tiền giảm. Hai luồng checkout và bán tại quầy dùng cùng hàm này.
Các dòng vẫn tách theo kho, tổng giảm khớp tuyệt đối sau làm tròn. Hàm tạo đơn
giao hàng/nhận tại cửa hàng cũng dùng cùng cách tính.

API quản lý `/api/data/vouchers` nhận trường `ma_loai_sp_ap_dung` (gửi null
để chuyển về tất cả). `/api/customer/vouchers` trả `category_id` cho từng mã;
báo giá trả loại sản phẩm cho từng dòng. Giao diện không đoán loại từ tên hàng.
Backend/database luôn kiểm tra lại khi áp mã và tạo đơn.

RPC đọc mới: `customer_quote_categories_v1`, `customer_voucher_choices_v2`.
RPC cũ giữ nguyên cấu trúc response để backend chưa deploy vẫn đọc được.
Hai migration đã cài trên Supabase; giao diện/API mới vẫn cần deploy để dùng
ô chọn phạm vi và hiển thị loại voucher trên web Render.

## Kiểm chứng

- SQL biệt lập: giỏ trộn loại, mức tối thiểu, giảm cố định/phần trăm, nhiều
  kho, hóa đơn/VAT, bán tại quầy, idempotency và chạy migration hai lần.
- Python: validation phạm vi và hợp đồng OpenAPI, gồm giá trị null.
- UI fixtures: thứ tự mã theo tiền giảm phù hợp, loại không khớp, chưa đạt
  mức tối thiểu, ba lựa chọn quản lý và chuyển phạm vi về tất cả.
- Không tạo đơn hoặc voucher thử trên dữ liệu thật để kiểm thử.

Kết quả phiên 17/11/2026: 1.524 test Python đạt; typecheck cả ba UI đạt;
test SQL và hai bài Chromium (checkout, form nhân viên) đạt. Báo giá và danh
sách voucher mới đã đọc thành công trên Supabase. Đối chiếu checksum trước/sau:
8 voucher, 74 đơn, 44 hóa đơn và 372 dòng tồn kho không đổi dữ liệu cũ.

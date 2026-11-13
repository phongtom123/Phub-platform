# Kế hoạch rút gọn thao tác xử lý đơn hàng

Ngày chốt phương án: 13/11/2026.
Trạng thái: đã thống nhất hướng làm, chưa triển khai theo tài liệu này.

## Mục tiêu

Giảm số lần nhân viên phải bấm để hoàn thành một đơn, xử lý tại trang chi tiết
đơn hiện có. Giữ hai khu vực nội bộ Admin và Nhân viên; không cần thêm role
hoặc portal để thực hiện phương án này.

Số thao tác dưới đây tính từ lúc đơn đã ở **Đang chuẩn bị**, không tính thao tác
thu tiền nếu đơn chưa thanh toán đủ. Không bắt xác nhận lại các bước đã hoàn tất.

## Luồng được duyệt

| Cách nhận hàng | Luồng sau thanh toán | Thao tác của nhân viên |
| --- | --- | --- |
| Nhận tại cửa hàng | Đang chuẩn bị → Hoàn thành | Một nút **Đã giao cho khách** |
| Giao tận nơi | Đang chuẩn bị → Đang giao → Hoàn thành | **Bàn giao vận chuyển**, sau đó **Xác nhận đã giao** |

### Nhận tại cửa hàng

Nhân viên chỉ bấm **Đã giao cho khách** khi thực tế đã giao hàng.
Backend thực hiện trong cùng transaction:

1. Kiểm tra quyền, phương thức nhận, trạng thái đơn, hóa đơn và số tiền đã thu.
2. Kiểm tra dữ liệu giữ hàng và tồn kho theo các dòng đơn.
3. Xuất kho, trừ tồn vật lý đúng một lần, kết thúc giữ hàng.
4. Chuyển đơn sang hoàn thành và ghi lịch sử người/thời điểm thực hiện.
5. Đơn hoàn thành trở thành căn cứ để khách được đánh giá sản phẩm.

Nếu chưa thu đủ tiền thì giải thích số còn phải thu và chặn hoàn thành. Không
tự ghi nhận đã thu tiền chỉ vì nhân viên bấm giao hàng. Lỗi ở bất kỳ bước ghi
nào phải rollback toàn bộ, không để đơn hoàn thành nhưng kho chưa cập nhật.

### Giao tận nơi

1. **Bàn giao vận chuyển**: nhân viên xác nhận đã bàn giao thực tế. Backend xuất
   kho, trừ tồn đúng một lần, kết thúc giữ hàng và chuyển đơn sang đang giao.
   COD vẫn được xuất trước khi thu đủ theo quy định hiện hành.
2. **Xác nhận đã giao**: sau khi khách thực tế nhận hàng, backend kiểm tra hóa
   đơn và thu đủ tiền rồi hoàn thành đơn. Không trừ kho thêm lần nữa.

Trong lần triển khai đầu, dự kiến dùng trạng thái kỹ thuật `DA_XUAT_KHO` cho
mốc đã bàn giao; hiển thị **Đang giao** đối với đơn giao tận nơi. Không tự đổi
mã trạng thái lịch sử hoặc coi mọi đơn đã xuất kho là đã giao xong.

## Những phần tự động

- Giữ cơ chế tạo hóa đơn cùng transaction đặt đơn online hiện có; có hóa đơn
  không đồng nghĩa đã thanh toán. Không bắt nhân viên lập lại hóa đơn đã có.
- Thanh toán/bypass thành công: ghi giao dịch và đưa đơn hợp lệ sang đang
  chuẩn bị; không bắt bấm lại Xác nhận đơn hoặc Chuẩn bị hàng.
- Nghiệp vụ xuất kho chạy bên trong nút giao/bàn giao tương ứng, thay cho một
  thao tác xuất kho riêng. Không chỉ ẩn nút cũ rồi để đơn bị kẹt.
- Sau lệnh thành công, cập nhật đơn, hóa đơn, tiền, tồn và lịch sử tại chỗ.
- Sau này có thể dùng thông báo giao thành công từ đơn vị vận chuyển để thay
  nút xác nhận đã giao; vẫn phải kiểm tra tính xác thực, chống xử lý trùng và
  điều kiện thanh toán. Chưa tích hợp vận chuyển trong phạm vi đầu tiên.

Không tự hoàn thành đơn khi thanh toán/bypass thành công hoặc sau một khoảng
thời gian. Không suy diễn đã nhận hàng từ việc đã xuất kho.

## Việc cần triển khai

- [ ] Bổ sung lệnh backend gộp giao tại cửa hàng với xuất kho và hoàn thành.
- [ ] Dùng nghiệp vụ xuất kho hiện có cho nút Bàn giao vận chuyển, tránh tạo
      một cơ chế trừ kho song song.
- [ ] Giữ transaction, khóa dữ liệu và idempotency: bấm lặp/thử lại hoặc hai
      nhân viên thao tác đồng thời không trừ kho, tạo hóa đơn hay thu tiền lặp.
- [ ] Giữ phân bổ theo kho của từng dòng đơn và quy tắc tồn khả dụng hiện có.
      Không thay bằng giới hạn một kho hoặc gộp dòng lưu trữ theo giao diện.
- [ ] Ghi lịch sử các nghiệp vụ được gộp, cùng người thực hiện, thời điểm và
      trạng thái thực tế; giữ tương thích báo cáo và lịch sử đơn cũ.
- [ ] Chỉ hiện nút bước tiếp theo tại trang chi tiết đơn của Nhân viên. Không
      bắt chuyển qua trang hóa đơn, thanh toán hoặc phiếu xuất để hoàn tất.
- [ ] Hiển thị lỗi backend đúng, không báo thành công trước khi transaction
      hoàn tất; giữ thông tin đối chiếu nếu kết quả request chưa xác định.
- [ ] Với đơn cũ thiếu phương thức nhận, giữ luồng hiện hành hoặc yêu cầu xác
      minh theo nghiệp vụ; không tự gán nhận tại cửa hàng.
- [ ] Giữ luồng đơn chưa thanh toán, hủy và hoàn tiền theo điều kiện riêng;
      không gom hủy đơn và hoàn tiền thành thao tác tự động không kiểm soát.

## Nghiệm thu khi triển khai

- [ ] Đơn nhận tại cửa hàng đã thu đủ: một lệnh giao hàng xuất kho và hoàn
      thành; khách đủ điều kiện đánh giá.
- [ ] Đơn giao tận nơi: bàn giao chỉ trừ kho một lần; xác nhận nhận hàng mới
      hoàn thành. COD chưa thu đủ không được hoàn thành.
- [ ] Thử lại cùng yêu cầu, bấm lặp và xử lý đồng thời không làm trừ kho lặp.
- [ ] Thiếu tồn, thiếu tiền, sai quyền, sai trạng thái hoặc lỗi transaction
      không để lại kết quả ghi một phần hay thông báo thành công sai.
- [ ] Đơn đã xuất trước khi nâng cấp vẫn hoàn thành được mà không trừ kho lại.
- [ ] Không tự mở quyền đánh giá cho đơn mới thanh toán hoặc mới bàn giao.

Tài liệu liên quan: [logic mua hàng](USER-COMMERCE-LOGIC.md),
[nhận tại cửa hàng](STORE-PICKUP.md), [danh sách công việc](PHUB-ADMIN-TODO.txt).

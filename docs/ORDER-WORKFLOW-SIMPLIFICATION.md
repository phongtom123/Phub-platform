# Danh sách việc cần làm — Rút gọn xử lý đơn hàng PCHUB

Cập nhật: **15/11/2026**. Phương án nghiệp vụ đã chốt ngày 13/11/2026.
Nhánh làm việc: `feat/backend-middleware-api`.
Trạng thái: **backend và giao diện đã làm trên nhánh `feat/order-fulfillment-shortcuts`;
chờ chạy migration `20261115100000_order_fulfillment_shortcuts.sql` lên Supabase và deploy**.

Chốt thêm ngày 15/11/2026: đơn bán tại quầy (chưa ghi phương thức nhận) tính là **Nhận tại cửa hàng**;
đơn online được thu đủ tiền tự chuyển sang **Đang chuẩn bị**, nhân viên không cần bấm xác nhận.

## 1. Kết quả cần đạt

Nhân viên xử lý đơn ngay tại trang chi tiết, không phải chuyển qua nhiều trang
hoặc bấm lại những bước đã hoàn tất. Giữ hai vai trò nội bộ Admin và Nhân viên.

Số thao tác trong bảng tính từ trạng thái **Đang chuẩn bị**; chưa tính việc thu
tiền nếu đơn còn thiếu tiền.

| Cách nhận | Nút thao tác | Kết quả |
|---|---|---|
| Nhận tại cửa hàng | **Đã giao cho khách** | Xuất kho và hoàn thành cùng một transaction, khi đã có hóa đơn và thu đủ tiền. |
| Giao tận nơi — bước 1 | **Bàn giao vận chuyển** | Xuất kho và chuyển sang Đang giao; COD vẫn được bàn giao trước khi thu đủ theo quy định hiện có. |
| Giao tận nơi — bước 2 | **Xác nhận đã giao** | Hoàn thành khi đã giao thực tế, có hóa đơn và thu đủ tiền; không trừ kho lần nữa. |

Không tự hoàn thành đơn khi thanh toán thành công, bypass hoặc hết một khoảng thời gian.

## 2. Phần đã có để tái sử dụng

Các dấu hoàn tất ở đây chỉ ghi nhận nền tảng đã có trong mã, không phải nghiệm thu luồng mới.

- [x] Checkout online tạo đơn và hóa đơn trong cùng transaction.
- [x] Bypass ghi giao dịch và có thể đưa đơn hợp lệ sang Đang chuẩn bị.
- [x] Có nghiệp vụ xác nhận, chuẩn bị, xuất kho, hoàn thành, hủy và thu/hoàn tiền.
- [x] Có trang chi tiết đơn tổng hợp sản phẩm, hóa đơn, thanh toán và lịch sử.
- [x] Có kiểm tra tồn khả dụng, khóa dữ liệu và chống ghi lặp.

## 3. Checklist triển khai

### Backend và database — làm trước

- [x] **BE-01 — Giao tại cửa hàng:** bổ sung một lệnh kiểm tra điều kiện,
  xuất kho và hoàn thành trong cùng transaction. Không ghép hai request xuất
  kho/hoàn thành từ frontend để thay cho transaction.
- [x] **BE-02 — Bàn giao vận chuyển:** dùng lại nghiệp vụ xuất kho hiện có;
  kiểm tra đúng phương thức nhận và trạng thái trước khi cho bàn giao.
- [x] **BE-03 — Xác nhận đã giao:** kiểm tra hóa đơn, số tiền đã thu và trạng
  thái đã bàn giao; hoàn thành đơn mà không trừ tồn thêm.
- [x] **BE-04 — Thanh toán:** rà các luồng thu tiền và bypass; đưa đơn hợp lệ
  sang Đang chuẩn bị theo điều kiện nghiệp vụ, không bắt xác nhận/chuẩn bị lại.
  Không tự ghi nhận tiền chỉ vì nhân viên bấm giao hàng.
- [x] **BE-05 — Chống ghi lặp:** giữ khóa đơn/tồn và idempotency cho các lệnh
  gộp. Thử lại cùng yêu cầu hoặc hai nhân viên thao tác đồng thời không được
  trừ tồn, tạo hóa đơn hay ghi khoản thu hai lần.
- [x] **BE-06 — Lịch sử và lỗi:** ghi người thực hiện, thời điểm và thao tác
  thực tế. Lỗi ở bất kỳ bước nào phải rollback toàn bộ và trả đúng nguyên nhân.
- [x] **BE-07 — Đơn cũ:** đơn đã xuất vẫn hoàn thành được mà không xuất lại;
  đơn thiếu phương thức nhận giữ luồng cũ hoặc yêu cầu xác minh, không tự gán
  thành Nhận tại cửa hàng.

Backend tiếp tục theo **Controller → Service → Repository**. Chỉ tạo migration
mới cho thay đổi cần thiết; không viết lại lịch sử đơn hoặc số liệu tồn cũ.

### Giao diện — sau khi đã có lệnh backend

- [x] **UI-01 — Nút theo phương thức nhận:** hiện Đã giao cho khách cho đơn
  nhận tại cửa hàng; hiện Bàn giao vận chuyển/Xác nhận đã giao cho đơn giao tận nơi.
- [x] **UI-02 — Nút theo bước tiếp theo:** không bắt lập lại hóa đơn, thu lại
  tiền hoặc xuất kho riêng nếu các bước đó đã được xử lý trong lệnh mới.
  Không chỉ ẩn nút cũ rồi để đơn không còn thao tác đi tiếp.
- [x] **UI-03 — Trạng thái:** dùng `DA_XUAT_KHO` cho mốc đã bàn giao trong
  lần triển khai đầu; hiển thị Đang giao đối với đơn giao tận nơi. Không đổi
  tên mọi đơn đã xuất, nhất là đơn cũ chưa rõ phương thức nhận.
- [x] **UI-04 — Điều kiện thao tác:** giải thích số tiền còn thiếu, thiếu hóa
  đơn hoặc thiếu tồn ngay tại trang; không báo thành công trước phản hồi backend.
- [x] **UI-05 — Cập nhật tại chỗ:** làm mới trạng thái, hóa đơn, tiền, tồn và
  lịch sử sau thành công; giữ vị trí cuộn. Nếu chưa rõ kết quả request, giữ
  cùng yêu cầu để thử lại và tránh tạo giao dịch mới.
- [ ] **UI-06 — Đồng bộ cách hiển thị:** rà chi tiết đơn, danh sách đơn, Phiếu
  xuất và phía khách hàng để các nhãn trạng thái không mâu thuẫn.
  Đã đồng bộ: danh sách và chi tiết đơn, Phiếu xuất, danh sách/chi tiết đơn của khách.
  Còn lại: lịch sử đơn trong hồ sơ khách (cổng nhân viên) và bảng dữ liệu chung.

## 4. Quy tắc phải giữ

- Nhân viên thực hiện nghiệp vụ; Admin giữ phạm vi quản trị và thống kê hiện có.
- Checkout gom tồn khả dụng từ mọi kho hoạt động; không trở lại kho cố định.
- Giữ phân bổ theo kho trong từng dòng `CT_DON_HANG`; chỉ gộp cách hiển thị.
- Thêm giỏ/xem báo giá không giữ hàng. Giữ nguyên quy tắc giữ hàng của đơn
  đang xử lý đã có hóa đơn hoặc khoản thu thành công.
- Có hóa đơn không đồng nghĩa đã thanh toán; xuất kho không đồng nghĩa khách đã nhận hàng.
- Hủy và hoàn tiền vẫn theo điều kiện riêng; không gộp thành thao tác tự động.
- Chỉ mở quyền đánh giá khi đơn thực sự Hoàn thành.
- Chưa tích hợp đơn vị vận chuyển hoặc tự xác nhận giao hàng trong đợt này.

## 5. Checklist nghiệm thu

Dùng fixtures hoặc PostgreSQL biệt lập cho các bài ghi dữ liệu. Không sửa tồn,
hủy đơn hoặc xóa thanh toán thật để làm cho giao diện trông đúng.

- [x] **KT-01:** nhận tại cửa hàng đã thu đủ → một lệnh xuất kho và hoàn thành;
  khách đủ điều kiện đánh giá.
- [x] **KT-02:** nhận tại cửa hàng chưa thu đủ → bị chặn, không thay đổi tồn/trạng thái.
- [x] **KT-03:** giao tận nơi → bàn giao chỉ trừ tồn một lần; xác nhận đã giao
  mới hoàn thành. COD chưa thu đủ không hoàn thành được.
- [x] **KT-04:** gửi lại cùng yêu cầu, bấm lặp và hai nhân viên xử lý đồng thời
  không tạo kết quả trùng.
- [x] **KT-05:** thiếu tồn, thiếu hóa đơn, sai quyền, sai trạng thái hoặc lỗi
  giữa transaction không để lại dữ liệu ghi một phần.
- [x] **KT-06:** đơn đã xuất trước nâng cấp hoàn thành được mà không trừ kho lại;
  đơn thiếu phương thức nhận không bị tự đổi loại nhận.
- [x] **KT-07:** thanh toán/bypass hoặc bàn giao vận chuyển chưa mở quyền đánh giá;
  lịch sử và báo cáo chỉ phản ánh trạng thái thực tế.
- [x] **KT-08:** dữ liệu trên giao diện được cập nhật sau thành công; lỗi giữ
  thông báo và cho thử lại an toàn.

Kết quả 15/11/2026: KT-01 → KT-07 đạt trên PostgreSQL biệt lập chạy chuỗi migration đơn hàng
(`Backend/tests/order-fulfillment-sql.test.cjs`); KT-08 đạt trên trình duyệt với API giả lập
(`ui/adminUI/tests/order-fulfilment.e2e.cjs`). Chưa kiểm thử trên môi trường đang chạy.

## 6. Hoàn tất và triển khai

- [x] Cập nhật API contract/OpenAPI, nhãn trạng thái và tài liệu kiểm thử theo mã đã làm.
- [x] Kiểm tra migration trên môi trường biệt lập trước khi áp dụng vào database dùng chung.
- [ ] Push nhánh feat, review, merge main rồi deploy API và các UI có thay đổi.
- [ ] Kiểm tra lại phiên bản và hai luồng nhận hàng sau deploy; ghi rõ kết quả
  kiểm thử local, fixtures và môi trường đang chạy.

**Việc vận hành riêng — sao lưu database:** mã script đã có; vẫn cần cấu hình
kết nối/credential, chạy backup thực tế, phục hồi thử vào PostgreSQL local và
cài lịch chạy. Không coi việc có script là đã có backup tự động hoạt động.
Xem [hướng dẫn sao lưu/phục hồi](../Backend/docs/SUPABASE-BACKUP-RESTORE.md).

Tài liệu đối chiếu: [logic mua hàng](USER-COMMERCE-LOGIC.md),
[nhận tại cửa hàng](STORE-PICKUP.md), [kiến trúc backend](../Backend/ARCHITECTURE.md).

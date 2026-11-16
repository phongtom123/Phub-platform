# Review luồng giao hàng rút gọn — 15/11/2026

## Phạm vi

- Nhánh được review: `feat/order-fulfillment-shortcuts`, HEAD `300b6d4`.
- Hai commit mới so với `f573d75`: `efea5a3` (backend), `300b6d4` (UI).
- Mã nằm trong worktree `C:\Users\Thinh\AppData\Local\Temp\claude\a54856178a50ce39\c92a4664-e6d5-49b2-b58c-f0254609c8da\scratchpad\orderflow`.
- Thư mục `BanPC` hiện ở `feat/backend-middleware-api`, HEAD `f573d75`; chưa có hai commit triển khai trên. Checklist tại đây đã được sửa nhưng chưa commit. Bản checklist trong nhánh triển khai vẫn ghi chưa triển khai.
- Review không áp dụng migration lên Supabase, không sửa đơn/tồn kho thật và không deploy/push.

## Kết luận

Luồng chính đạt các kiểm thử đã chạy lại: giao tại cửa hàng, bàn giao vận chuyển khi chưa thu đủ tiền, chặn hoàn thành khi chưa thanh toán, không trừ kho lần hai khi hoàn thành đơn đã xuất và thử lại cùng khóa không ghi lặp.

Chưa nên đánh dấu toàn bộ checklist kiểm thử và lịch sử xử lý là hoàn tất vì các điểm dưới đây.

## Điểm cần chỉnh

### 1. P2 — Lịch sử các bước gộp có thể sai thứ tự

Vị trí: `Backend/migrations/20261115100000_order_fulfillment_shortcuts.sql:85-90`, kết hợp `admin_order_history_v1` và `admin_ops.requests.created_at`.

Lệnh ngoài và từng bước con cùng được ghi vào `admin_ops.requests`. Cột `created_at` mặc định dùng `now()` nên trong một transaction các bản ghi có cùng thời điểm; API lịch sử sắp tiếp theo UUID. UUID không thể hiện thứ tự thực thi.

Đã tái hiện bằng PostgreSQL biệt lập: sau giao tại cửa hàng, API trả các sự kiện theo thứ tự `dispatch → complete → handover → prepare`. Giao diện vì vậy có thể trình bày hoàn thành trước chuẩn bị. Backend còn suy ra `from_status = to_status` cho thao tác mới chưa có trong bảng ánh xạ.

Cần quy ước lịch sử cho lệnh gộp: một sự kiện tổng hợp có trạng thái trước/sau và các bước con có thứ tự, hoặc chỉ công khai các bước con với thứ tự thực thi được lưu rõ ràng.

### 2. P2 — Tự chuyển sang chuẩn bị chưa có lịch sử tương ứng

Vị trí: `Backend/migrations/20261115100000_order_fulfillment_shortcuts.sql:108-109`; `Backend/phub_api/services/admin_order_detail.py:13-16,93-96`.

Trigger đổi trạng thái trực tiếp khi đơn online được thu đủ tiền, nhưng không ghi sự kiện chuẩn bị. Trên fixture đã tái hiện: lịch sử chỉ có `payment` mang trạng thái `DANG_CHUAN_BI`; hàm dựng lịch sử mặc định coi đây là `DANG_CHUAN_BI → DANG_CHUAN_BI`, mất thông tin chuyển từ trạng thái trước.

Cần lưu hoặc trả đúng sự kiện chuyển trạng thái tự động, phân biệt với giao dịch thu tiền.

### 3. Giao diện và tài liệu chưa đồng bộ hết

- `ui/adminUI/src/features/orders/order-embedded-sections.tsx:13`: chưa có nhãn tiếng Việt cho `handover`, `ship`, `deliver`; hiện rơi về chuỗi action gốc. Timeline cũng chưa dùng cách gọi “Đang giao” theo phương thức nhận.
- `ui/adminUI/src/features/customers/customer-detail.tsx:20,207`: lịch sử đơn trong hồ sơ khách vẫn gọi đơn giao tận nơi đã xuất là “Đã xuất kho”.
- `ui/adminUI/src/lib/inline-table-data.ts:6`: bảng dữ liệu chung vẫn dùng nhãn cũ. Hai vị trí này đúng là UI-06 còn dở như báo cáo.
- Cần đưa bản checklist cập nhật vào chính nhánh triển khai trước khi push/review PR; hiện bản đã đánh dấu hoàn tất chỉ nằm ở thay đổi chưa commit trong `BanPC`.

## Kiểm thử đã chạy lại

| Kiểm thử | Kết quả | Giới hạn |
| --- | --- | --- |
| Toàn bộ Python backend | 1505/1505 đạt | Test suite, không phải thao tác trên web Render |
| SQL `order-fulfillment-sql.test.cjs` | Đạt | PostgreSQL biệt lập qua PGlite, chạy migration hai lần |
| Chromium `order-fulfilment.e2e.cjs` | Đạt | Server đúng worktree tại cổng 3012; toàn bộ API được giả lập |
| Unit test nhãn trạng thái và trình bày danh sách đơn | 5/5 đạt | Chỉ các test liên quan đã thay đổi |
| Typecheck admin, nhân viên và khách hàng | Cả ba đạt | Không thay cho production build |
| Probe API lịch sử sau lệnh gộp và thanh toán | Tái hiện hai vấn đề trên | Dữ liệu giả lập trong PostgreSQL biệt lập |

Server 3012 phục vụ review đã được dừng sau kiểm thử. Không khởi động lại hoặc thay cấu hình các cổng người dùng đang sử dụng.

## Không nên diễn giải quá mức kết quả test

- KT-04: test SQL hiện gọi nhân viên thứ nhất xong rồi mới gọi nhân viên thứ hai (`order-fulfillment-sql.test.cjs:103-106`), chưa kiểm tra hai transaction PostgreSQL chạy đồng thời. Nó chứng minh chặn trạng thái cũ, chưa chứng minh đầy đủ xử lý cạnh tranh khóa.
- KT-05: ca thiếu tồn chạy trước khi trừ kho; chưa có ca chủ động gây lỗi ở bước hoàn thành sau khi bước xuất kho đã chạy.
- KT-07: file test mới chưa trực tiếp kiểm tra quyền đánh giá sau hoàn thành hay kết quả báo cáo kinh doanh. Kiểm tra sự tồn tại action trong bảng requests chưa chứng minh lịch sử được trình bày đúng.
- Trong lần review này chưa chạy lại toàn bộ 136 test UI, chưa chạy production build và chưa kiểm thử Render. Không dùng các kết quả phía trên để kết luận các phần đó đã đạt.

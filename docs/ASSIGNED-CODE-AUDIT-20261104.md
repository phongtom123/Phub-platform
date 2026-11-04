# Đối chiếu mã thực tế với ticket được giao cho Hoang T

Ngày: 04/11/2026. Mã local: main `03edc23`. Phạm vi: 10 ticket chưa Done, truy vấn lại từ Jira theo `assignee = currentUser()`. Chỉ đọc mã và kiểm thử bằng fixtures/PGlite biệt lập; không đổi Jira, không kiểm tra trạng thái deploy Render/Supabase và không ghi nghiệp vụ thật.

**Kết luận:** nhiều phần đã được triển khai; danh sách Jira không phản ánh đầy đủ hiện trạng mã. Không nên xây lại toàn bộ các chức năng này. KAN-16/KAN-52 có phần triển khai chính và kiểm thử; KAN-17/19/60/63/39/40 mới đáp ứng một phần; chưa thấy cơ chế KAN-61 hoặc bộ sơ đồ Admin KAN-36 trong repo. Các phân loại này không tự thay thế nghiệm thu hoặc chuyển Jira sang Done.

## Bảng hiện trạng

| Ticket | Mã đã có | Thiếu hoặc cần nghiệm thu |
|---|---|---|
| [KAN-16](https://pc-seller-platform.atlassian.net/browse/KAN-16) — loại SP, SP, SKU, ảnh | API đọc/tạo/cập nhật loại cha/con và SP; SKU unique ở schema, SKU bất biến khi sửa; kiểm tra giá/bảo hành/trạng thái; tìm/lọc/phân trang; upload và gallery; UI Admin | Phần triển khai chính đã có. Nghiệm thu theo phương án dùng trạng thái thay xóa cứng đã thống nhất; không làm lại toàn bộ CRUD/gallery chỉ vì Jira còn In Discussion. |
| [KAN-17](https://pc-seller-platform.atlassian.net/browse/KAN-17) — NCC | API tạo/sửa/đổi trạng thái, tìm tên/mã và phân trang; nhân viên kho được ghi NCC; transaction lập/sửa phiếu kiểm tra NCC hoạt động; UI kho có form và ngừng hoạt động | UI NCC chỉ tải trang đầu 100 dòng, lọc trong RAM, không có phân trang server/đọc tiếp. Xóa trống SĐT/email/địa chỉ ở form sửa gửi undefined nên bỏ trường khỏi PATCH, chưa xóa được dữ liệu cũ. |
| [KAN-19](https://pc-seller-platform.atlassian.net/browse/KAN-19) — tra cứu tồn | API generic tồn theo SKU/kho, phân trang; nhân viên bị giới hạn ma_kho phía server; UI kho có tìm kiếm, phân trang trong bộ dữ liệu tải về, trạng thái sắp hết <= 5 | Loader UI chỉ lấy 100 dòng đầu tồn và SP, bỏ qua total. Các trang UI sau chỉ chia lại 100 dòng đó; tìm SKU ngoài trang đầu không thấy. Ngưỡng sắp hết đang cố định 5 ở UI. |
| [KAN-52](https://pc-seller-platform.atlassian.net/browse/KAN-52) — định giá | Preview bằng Decimal ở backend, nhiều thuế, HALF_UP VND, version chống xác nhận giá cũ; ADMIN sửa đầu vào, nhân viên kho không override; transaction xác nhận cập nhật giá trước thuế đúng một lần; UI hai bên hiển thị kết quả | Phần triển khai chính đã có theo phương án định giá trên phiếu. Mô tả Jira cũ còn đòi THUE/SAN_PHAM_THUE và cấu hình trên SP; cần cập nhật tiêu chí theo yêu cầu đã bỏ các bảng này rồi nghiệm thu phần còn lại. |
| [KAN-60](https://pc-seller-platform.atlassian.net/browse/KAN-60) — ba số tồn | Catalog tính khả dụng theo từng SKU/kho, trừ đơn xử lý có hóa đơn hoặc khoản thu thành công; cộng kho hoạt động; checkout/activation có khóa và kiểm tra lại; khách thấy số còn mua được | Admin/Kho hiện chủ yếu đọc so_luong_ton vật lý. Chưa có contract/bảng hiển thị riêng đủ vật lý/đang giữ/khả dụng theo SKU/kho; API chi tiết đơn mới cũng chưa trả bộ ba này. |
| [KAN-61](https://pc-seller-platform.atlassian.net/browse/KAN-61) — hết hạn giữ hàng | Có nền tảng hủy đơn và giải phóng reservation khi hủy hợp lệ | Chưa tìm thấy thời điểm hết hạn giữ đơn, cấu hình TTL, tác vụ xử lý đơn quá hạn hoặc transaction xử lý hết hạn/thanh toán đồng thời. JWT/handoff expiry trong repo không phải hết hạn giữ hàng. |
| [KAN-63](https://pc-seller-platform.atlassian.net/browse/KAN-63) — kho/quyền xuất | Kho hoạt động đã được mở lại, checkout đa kho; đọc dữ liệu kho theo phân công; xuất đơn hiện có trong Admin và chỉ ADMIN được ghi qua AdminOperationsService | Cần chốt/ghi rõ quyền xuất. UI kho vẫn có menu Phiếu xuất/Chuyển kho và hàm gọi dispatch/transfers, trong khi controller /api/warehouse hiện chỉ có receipts/history; không có API dispatch cho nhân viên. Backend retired transfers chưa đồng nhất với menu kho còn hiện. |
| [KAN-36](https://pc-seller-platform.atlassian.net/browse/KAN-36) — sequence Admin | Có sơ đồ sequence phía khách và file 5_10.drawio | Chưa tìm thấy bộ sơ đồ tuần tự Admin trong repo. Đã đọc XML: user-sequence-diagrams-v2 là phía khách; 5_10.drawio chứa BFD/DFD, không thay cho sequence Admin. Không kết luận về file có thể nằm ngoài repo/Drive. |
| [KAN-39](https://pc-seller-platform.atlassian.net/browse/KAN-39) — chốt thiết kế CRM | Có CRM-TODO, tài liệu phạm vi profile, API profile/tài khoản/đơn và hỗ trợ khách; schema và ma trận quyền đã thể hiện một phần trong mã | Mô tả Jira cũ vẫn dùng THU_KHO, sở thích và 6 bảng khảo sát. Phạm vi đã đổi sang NHAN_VIEN và bỏ sở thích; chưa thấy hồ sơ thiết kế/ERD/hợp đồng API khảo sát được hoàn thiện và review theo phạm vi mới. |
| [KAN-40](https://pc-seller-platform.atlassian.net/browse/KAN-40) — migration/DBML CRM | Migration ngày sinh, mốc thời gian, RPC profile, trigger cập nhật thời gian; parser DBML hỗ trợ date/timestamptz/uuid/boolean; schema request bảo vệ trường hệ thống; PHAN_HOI; migration bỏ sở thích; có kiểm thử SQL | Chưa có đầy đủ 9 bảng theo mô tả cũ: sở thích đã bỏ có chủ đích, khảo sát chưa triển khai. Chưa xác nhận backup/restore/rollback toàn bộ phạm vi và nghiệm thu môi trường deploy. Cần đồng bộ phạm vi với KAN-39 trước khi đánh giá Done. |

## Bằng chứng mã chính

- API bảng dùng chung: `Backend/phub_api/controllers/tables.py`, `services/tables.py`, `repositories/tables.py`, `models/resources.py`, `schemas/resources.py`. API tồn/NCC có phân trang thật; giới hạn 100 nêu trên nằm ở loader UI kho, không phải API chỉ hỗ trợ 100 bản ghi toàn hệ thống.
- SP/SKU: `Backend/schema.dbml` (unique SKU, CHECK giá/bảo hành), `Backend/phub_api/controllers/media.py`, `services/media.py`, các migration shared_media/product_gallery và UI product gallery Admin.
- NCC: `ui/warehouseUI/src/features/suppliers/supplier-view.tsx`; `ui/warehouseUI/src/lib/warehouse-api.ts` (getSuppliers/page); NCC hoạt động được kiểm tra trong `20261028132157_admin_operations.sql` và `20261029162141_warehouse_receipts.sql`.
- Tồn: `ui/warehouseUI/src/lib/warehouse-api.ts:getInventory`, `src/controllers/warehouse-controller.ts`, `src/features/modules/module-view.tsx`; API scope tại `Backend/phub_api/repositories/tables.py:scoped_query`.
- Định giá: `Backend/phub_api/services/pricing.py`, `controllers/pricing.py`, `20261030151651_simplify_receipt_pricing.sql`, `Backend/docs/RECEIPT_PRICING.md`, UI Admin pricing-editor và kho receipt-pricing.
- Reservation: `Backend/phub_api/services/catalog_availability.py`, `repositories/catalog.py`, `20261102151044_reserve_stock_after_invoice_or_payment.sql`; Admin product-stock-data hiện cộng số vật lý.
- Quyền kho/xuất: `Backend/phub_api/controllers/warehouse.py`, `services/admin_operations.py`, `20261101162759_unlock_warehouses.sql`, `ui/warehouseUI/src/components/warehouse/sidebar.tsx`, `ui/warehouseUI/src/lib/warehouse-api.ts`.
- CRM: `Backend/schema.dbml`, `Backend/phub_api/controllers/crm.py`, `schemas/crm.py`, `models/resources.py`, `schemas/resources.py`, migrations CRM 22/10, `20261023012955_remove_customer_interests.sql`, `docs/CRM-TODO.md`, `docs/CRM-ADMIN-PROFILE.md`.

## Kiểm tra trong lượt này

1. **105 pytest đạt:** pricing, warehouse, CRM, product gallery, catalog filters. MockTransport/fixtures chặn HTTP thật. Các test platform/architecture/OpenAPI trên cùng commit đã chạy đạt ở lượt review main trước đó; không chạy lại toàn bộ chỉ để đếm nhiều test.
2. **PGlite định giá đơn giản hóa đạt:** nâng cấp giữ nguyên giá/tồn/lịch sử; bỏ 4 bảng và 6 trường tính lại; thuế nằm trên phiếu; xác nhận/replay/rollback/khóa phiếu và quyền nhân viên.
3. **PGlite bỏ sở thích đạt:** giữ profile/hỗ trợ/kho và dữ liệu liên quan; RPC mới và quyền được kiểm tra. Đây không phải nghiệm thu đủ toàn bộ khảo sát/CRM theo ticket cũ.
4. **PGlite mở kho đạt:** kho hoạt động, quyền nhân viên theo kho, từ chối kho ngừng, xác nhận phiếu/idempotency, checkout nhiều kho; transfer vẫn retired.
5. **PGlite stock commitment đạt:** giỏ/báo giá/nháp chưa giữ; hóa đơn hoặc khoản thu giữ một lần; thiếu hàng rollback; hủy giải phóng; xuất yêu cầu commitment.
6. **Fixture loader TS thực tế, không dùng mạng:** API giả có total=101. Gọi nguyên getInventory/getSuppliers từ mã đang có chỉ lấy 100 dòng, không request page=2. Xác nhận được vấn đề cắt trang đầu của UI kho.
7. Đọc XML các draw.io và tìm mã/migration hết hạn giữ đơn để phân biệt chức năng thực với tên file/TTL phiên đăng nhập.

## Điều chỉnh danh sách làm tiếp

1. **KAN-17/19:** sửa chỗ thiếu đã xác nhận của UI kho (đọc/phân trang đủ dữ liệu; PATCH xóa trường tùy chọn), không xây lại API NCC/tồn đã có.
2. **KAN-60:** bổ sung contract và hiển thị ba số tồn riêng; tái sử dụng reservation hiện có.
3. **KAN-63:** đồng bộ menu/UI với quyền/API thực, ghi rõ Admin hay nhân viên được xuất; giữ chuyển kho ngoài phạm vi đã chốt.
4. **KAN-61:** triển khai sau khi chốt chính sách thời hạn, vì cơ chế nghiệp vụ này chưa có.
5. **KAN-16/52:** nghiệm thu phần đã có và cập nhật tiêu chí lỗi thời, chỉ sửa thiếu sót có bằng chứng.
6. **KAN-36:** bổ sung sơ đồ Admin nếu chưa có ở nguồn tài liệu khác.
7. **KAN-39/40:** đồng bộ phạm vi CRM đã đổi, rồi xác định chính xác phần thiết kế/migration/nghiệm thu còn thiếu; không khôi phục sở thích/bảng thuế đã bỏ.

Lượt này chỉ kiểm tra và cập nhật tài liệu. Không tự nhận ticket người khác, không sửa mã ứng dụng, không chuyển trạng thái Jira và không push Git.

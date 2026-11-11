# Phân công vẽ đầy đủ sơ đồ PHUB — nhân viên và khách hàng

Cập nhật: 10/11/2026 · Bản 2, thay danh sách gộp 55 sơ đồ trước đó.

Đối chiếu mã local nhánh `feat/backend-middleware-api`, commit nền `ffa16a3` và thay đổi local đang có. Đây là danh mục thiết kế tài liệu, không thay thế kiểm thử phần mềm.

## Phạm vi

- Admin đã hoàn thành; chỉ tham chiếu khi dùng chung luồng.
- Chủ dự án phụ trách ERD/lược đồ CSDL.
- Bốn người vẽ các chức năng còn lại; điền tên thực tế tại mỗi nhóm.
- Tách thao tác nghiệp vụ: thêm, sửa, xác nhận, hủy, thu, hoàn, xuất… Không chỉ đếm menu.
- Tìm kiếm/lọc/phân trang và lỗi thuộc luồng tương ứng, không tách sơ đồ cho từng nút. Sửa form và sửa nhanh cùng quy tắc có thể dùng một Workflow có nhánh.
- Sequence chọn tình huống đáng mô tả trao đổi xử lý. Các phép CRUD tương tự không nhất thiết thêm một Sequence riêng.
- **Đây là danh mục đầy đủ do nhóm lựa chọn, không phải số lượng sơ đồ bắt buộc của đề.** Có thể đặt hình chi tiết ở phụ lục.

## Bảng giao việc

| Người | Phạm vi | Workflow | Sequence | Tổng | File riêng |
| --- | --- | ---: | ---: | ---: | --- |
| Người 1 | Nhân viên — sản phẩm, danh mục và kho | 31 | 11 | 42 | [Danh sách người 1](phan-cong-so-do/NGUOI-1.md) |
| Người 2 | Nhân viên — khách hàng, bán hàng và khuyến mãi | 32 | 12 | 44 | [Danh sách người 2](phan-cong-so-do/NGUOI-2.md) |
| Người 3 | Khách hàng — tài khoản, địa chỉ và mua hàng | 34 | 12 | 46 | [Danh sách người 3](phan-cong-so-do/NGUOI-3.md) |
| Người 4 | CRM hai phía — hỗ trợ, khảo sát, đánh giá và sở thích | 27 | 12 | 39 | [Danh sách người 4](phan-cong-so-do/NGUOI-4.md) |
| **Tổng** | Không tính admin, ERD và các hình tổng thể bên dưới | **124** | **47** | **171** | |

Cân đối theo độ khó, không ép số hình bằng nhau: Người 1 xử lý tồn và phiếu nhập; Người 2 xử lý xuất/tài chính; Người 3 có giỏ theo danh tính và transaction đặt hàng; Người 4 có khảo sát, hội thoại và đánh giá hai phía.

## Ranh giới để không trùng việc

| Nghiệp vụ | Chủ trì | Điểm nối |
| --- | --- | --- |
| Sản phẩm và tồn | Người 1 | Người 3 dùng trạng thái bán và tồn khả dụng; mọi kho hoạt động |
| Đơn, hóa đơn, thu/hoàn và xuất | Người 2 | Người 3 đặt/hủy/xem đơn, cùng trạng thái và cách tính tiền |
| Voucher | Người 2 | Người 2 quản lý chương trình/mã; Người 3 áp dụng và lấy báo giá |
| Liên kết hóa đơn | Người 2 | Người 4 vẽ khách gửi ticket; Người 2 vẽ đối chiếu và quyết định |
| Hồ sơ khách | Người 2 | Người 3 sửa thông tin của chính khách; không giao nhân viên quyền admin quản lý tài khoản |
| Hỗ trợ, khảo sát, đánh giá, sở thích | Người 4 | Vẽ cả phía khách và nhân viên để thống nhất dữ liệu/quyền |
| Tài khoản và sổ địa chỉ khách | Người 3 | Địa chỉ/default cung cấp thông tin cho checkout |
| ERD | Chủ dự án | Mọi người báo dữ liệu đọc/ghi; không sửa DB để khớp hình |

## Người 1 — Nhân viên — sản phẩm, danh mục và kho

**Người nhận:** [Điền tên] · **Bàn giao:** 31 Workflow + 11 Sequence = 42 sơ đồ.

### Workflow

| Mã | Xong | Chức năng | Điều kiện/nội dung phải thể hiện |
| --- | --- | --- | --- |
| N1-W01 | [ ] | Tra cứu và xem chi tiết sản phẩm | Tìm/lọc, trạng thái, thông tin, giá bán, tồn và nhà cung cấp; xem lỗi/không có dữ liệu. |
| N1-W02 | [ ] | Thêm sản phẩm | Kiểm tra mã/SKU, loại cha/con, giá, đơn vị, bảo hành; tạo sản phẩm, chưa tự tăng tồn. |
| N1-W03 | [ ] | Sửa thông tin sản phẩm | Trang sửa hoặc double click trên bảng; kiểm tra dữ liệu và chỉ gửi phần được phép sửa. |
| N1-W04 | [ ] | Đổi trạng thái sản phẩm | Đang bán, ẩn, tạm ngừng; phân biệt trạng thái bán với hết tồn. |
| N1-W05 | [ ] | Quản lý gallery sản phẩm | Tải nhiều ảnh hoặc URL, đổi ảnh chính/thứ tự, gỡ ảnh; chỉ lưu khi xác nhận; retry tải dở. |
| N1-W06 | [ ] | Tra cứu loại sản phẩm | Danh sách loại cha/con, trạng thái và sản phẩm thuộc loại. |
| N1-W07 | [ ] | Thêm loại sản phẩm cha | Nhập mã/tên, kiểm tra trùng, lưu. |
| N1-W08 | [ ] | Sửa loại cha và trạng thái | Sửa tên/trạng thái theo form hoặc bảng; kiểm tra quan hệ hiện có. |
| N1-W09 | [ ] | Thêm loại sản phẩm con | Chọn đúng loại cha, kiểm tra mã/tên, lưu. |
| N1-W10 | [ ] | Sửa loại con và trạng thái | Kiểm tra loại cha và quan hệ với sản phẩm; không tự thêm thao tác xóa. |
| N1-W11 | [ ] | Tra cứu nhà cung cấp | Tìm, lọc, xem thông tin và phiếu nhập liên quan. |
| N1-W12 | [ ] | Thêm nhà cung cấp | Thông tin liên hệ, kiểm tra dữ liệu, lưu. |
| N1-W13 | [ ] | Sửa nhà cung cấp | Sửa thông tin trên form hoặc bảng, lưu và đọc kết quả. |
| N1-W14 | [ ] | Đổi trạng thái nhà cung cấp | Ngừng/hoạt động; giữ lịch sử chứng từ. |
| N1-W15 | [ ] | Tra cứu kho | Tìm/lọc, xem thông tin và tồn kho liên quan. |
| N1-W16 | [ ] | Thêm kho | Thông tin kho, trạng thái và kiểm tra dữ liệu. |
| N1-W17 | [ ] | Sửa thông tin kho | Sửa thông tin theo form/bảng; không phải phân quyền nhân viên. |
| N1-W18 | [ ] | Đổi trạng thái kho | Kiểm tra điều kiện và trạng thái; không đổi sang mô hình phân quyền theo kho. |
| N1-W19 | [ ] | Tra cứu tổng tồn sản phẩm | Đọc đủ các trang, cộng theo SKU trên mọi kho; tìm trên dữ liệu đã tải trong RAM. |
| N1-W20 | [ ] | Xem tồn theo từng kho | Từ tổng tồn mở chi tiết từng kho; phân biệt tồn ghi nhận với tồn khả dụng để bán. |
| N1-W21 | [ ] | Kiểm kê và điều chỉnh tồn | Chọn kho/SKU, nhập lượng kiểm kê và lý do; kiểm tra hàng đang giữ; ghi lịch sử. |
| N1-W22 | [ ] | Tra cứu phiếu nhập | Tìm/lọc và xem chi tiết phiếu cùng dòng hàng, nhà cung cấp, người lập, trạng thái. |
| N1-W23 | [ ] | Tạo phiếu nhập nháp | Chọn nhà cung cấp/kho, sản phẩm, số lượng, giá nhập; lưu nháp chưa cộng tồn. |
| N1-W24 | [ ] | Sửa phiếu nhập nháp | Sửa thông tin và dòng hàng khi còn NHAP; kiểm tra phiên bản, chặn sửa sau xác nhận. |
| N1-W25 | [ ] | Hủy phiếu nhập nháp | Xác nhận hủy khi còn NHAP; giữ nguyên tồn kho và lịch sử. |
| N1-W26 | [ ] | Xem trước định giá khi nhập | Giá nhập, tỷ lệ lợi nhuận, thuế và giá bán dự kiến; đối chiếu bản báo giá trước xác nhận. |
| N1-W27 | [ ] | Xác nhận nhập kho | Transaction kiểm tra phiếu, giá/phiên bản; cộng tồn, cập nhật giá theo quy tắc và ghi lịch sử một lần. |
| N1-W28 | [ ] | Tra cứu lịch sử kho | Lọc/tìm, phân trang, xem thông tin biến động; số âm là lượng xuất, không mặc định là tồn âm. |
| N1-W29 | [ ] | Cài đặt hệ thống của nhân viên | Đọc/sửa tên, địa chỉ, điện thoại cửa hàng và ngưỡng tồn thấp theo SettingsForm; không có kho mặc định. |
| N1-W30 | [ ] | Xem tài khoản cá nhân nhân viên | Mở /account để xem danh tính phiên. Form đổi mật khẩu đang gọi endpoint chưa khai báo; phần đổi mật khẩu chuyển sang N1-G02, không mô tả thành công giả. |
| N1-W31 | [ ] | Xem và đánh dấu thông báo nội bộ | Mở chuông, đọc feed; bấm thông báo gọi lệnh read rồi điều hướng. Không có bước gửi email. |

### Sequence

| Mã | Xong | Tình huống | Workflow liên quan | Nội dung phải thể hiện |
| --- | --- | --- | --- | --- |
| N1-S01 | [ ] | Tạo sản phẩm | N1-W02 | Tạo bản ghi, kiểm tra SKU và quan hệ loại; không tạo tồn tự động. |
| N1-S02 | [ ] | Cập nhật sản phẩm và gallery | N1-W03, N1-W05 | Lưu thông tin và ảnh theo đúng thứ tự; thêm Storage khi mô tả tải file, xử lý lỗi từng phần. |
| N1-S03 | [ ] | Thêm/sửa loại sản phẩm con | N1-W09, N1-W10 | Kiểm tra loại cha và tính hợp lệ trước cập nhật. |
| N1-S04 | [ ] | Đọc và tổng hợp tồn trong RAM | N1-W19, N1-W20 | Repository đọc đủ trang; UI cộng theo SKU, gõ tìm không tạo truy vấn mới. |
| N1-S05 | [ ] | Điều chỉnh tồn sau kiểm kê | N1-W21 | Khóa/kiểm tra lượng giữ, ghi chênh lệch và lịch sử trong transaction. |
| N1-S06 | [ ] | Tạo phiếu nhập nháp | N1-W23 | Tạo chứng từ và dòng hàng, chưa thay đổi tồn. |
| N1-S07 | [ ] | Sửa phiếu nhập nháp | N1-W24 | Kiểm tra trạng thái/phiên bản, thay dòng hàng đúng transaction. |
| N1-S08 | [ ] | Tính báo giá nhập và giá bán dự kiến | N1-W26 | Gọi pricing preview, tính/kiểm tra kết quả; không coi preview là ghi sổ. |
| N1-S09 | [ ] | Xác nhận nhập kho | N1-W27 | Chứng từ, dòng nhập, giá và tồn/lịch sử cập nhật một lần; chống xác nhận lặp. |
| N1-S10 | [ ] | Hủy phiếu nhập nháp | N1-W25 | Kiểm tra điều kiện, cập nhật chứng từ; không cộng/trừ tồn. |
| N1-S11 | [ ] | Đọc và đánh dấu thông báo nội bộ | N1-W31 | Đọc feed, gửi ids đã đọc bằng lệnh notifications/read, chỉ điều hướng sau kết quả thành công. |

### Mã nguồn đối chiếu

- [ui/adminUI/src/components/backend-data-view.tsx](../ui/adminUI/src/components/backend-data-view.tsx)
- [ui/adminUI/src/features/forms/product-gallery-editor.tsx](../ui/adminUI/src/features/forms/product-gallery-editor.tsx)
- [ui/adminUI/src/features/operations/operation-panel.tsx](../ui/adminUI/src/features/operations/operation-panel.tsx)
- [ui/adminUI/src/features/pricing/pricing-editor.tsx](../ui/adminUI/src/features/pricing/pricing-editor.tsx)
- [ui/warehouseUI/src/features/internal/inventory-totals.tsx](../ui/warehouseUI/src/features/internal/inventory-totals.tsx)
- [ui/warehouseUI/src/features/internal/staff-profile.tsx](../ui/warehouseUI/src/features/internal/staff-profile.tsx)
- [ui/warehouseUI/app/[section]/page.tsx](../ui/warehouseUI/app/[section]/page.tsx)
- [Backend/phub_api/controllers/warehouse.py](../Backend/phub_api/controllers/warehouse.py)
- [Backend/phub_api/controllers/warehouse_drafts.py](../Backend/phub_api/controllers/warehouse_drafts.py)
- [Backend/phub_api/controllers/pricing.py](../Backend/phub_api/controllers/pricing.py)
- [Backend/phub_api/controllers/media.py](../Backend/phub_api/controllers/media.py)
- [ui/adminUI/src/features/operations/header-tools.tsx](../ui/adminUI/src/features/operations/header-tools.tsx)

Lần theo controller → service → repository → migration đúng nghiệp vụ. Có file hoặc nút UI không có nghĩa đường chạy đã được kiểm thử end-to-end.

### Điểm lệch cần ghi chú, chưa mô tả thành công

| Mã | Vấn đề | Bằng chứng/phạm vi |
| --- | --- | --- |
| N1-G01 | Điều hướng loại sản phẩm con | backend-resources.ts chưa ánh xạ subcategories về categories; một số đường /data/subcategories có thể rơi về dashboard và bị guard staff chặn. Kiểm tra đường UI cụ thể trước khi chốt sơ đồ luồng truy cập. |
| N1-G02 | Đổi mật khẩu nhân viên | StaffProfile gọi POST /api/backend/auth/me/password nhưng không thấy route /api/auth/me/password trong backend hiện tại; chỉ có route /api/admin/me/password dành admin. Vẽ rõ nhánh endpoint không tồn tại ở bản hiện tại; chưa tính Sequence đổi mật khẩu thành công vào danh sách. |

## Người 2 — Nhân viên — khách hàng, bán hàng và khuyến mãi

**Người nhận:** [Điền tên] · **Bàn giao:** 32 Workflow + 12 Sequence = 44 sơ đồ.

### Workflow

| Mã | Xong | Chức năng | Điều kiện/nội dung phải thể hiện |
| --- | --- | --- | --- |
| N2-W01 | [ ] | Tra cứu và xem hồ sơ khách | Tìm/lọc, hồ sơ, tài khoản liên kết, lịch sử đơn; không tự cho nhân viên quản lý mọi tài khoản. |
| N2-W02 | [ ] | Thêm hồ sơ khách hàng | Tạo hồ sơ theo form hiện có; phân biệt hồ sơ với tài khoản đăng nhập. |
| N2-W03 | [ ] | Sửa hồ sơ khách hàng | Thông tin, ngày sinh, địa chỉ; API không nhận thay đổi quyền tài khoản qua hồ sơ. |
| N2-W04 | [ ] | Xóa mềm hồ sơ khách hàng | Xác nhận lưu trữ; giữ chứng từ, liên hệ điều kiện đăng nhập theo RPC. |
| N2-W05 | [ ] | Khôi phục hồ sơ khách hàng | Gỡ lưu trữ; không tự mở lại tài khoản bị ẩn/khóa. |
| N2-W06 | [ ] | Xem lịch sử đơn theo khách | Lọc ownership theo khách được chọn, mới nhất/phân trang, mở đúng đơn. |
| N2-W07 | [ ] | Tra cứu và xem chi tiết đơn hàng | Bộ lọc, dòng hàng, người phụ trách, hóa đơn, thanh toán, voucher và thông tin nhận hàng. |
| N2-W08 | [ ] | Tra cứu khách bằng email tại quầy | Email chính xác, chỉ khách hợp lệ; đổi email phải xóa lựa chọn cũ; nhánh khách vãng lai. |
| N2-W09 | [ ] | Tạo đơn bán tại quầy | Chọn sản phẩm/số lượng/kho, giá từ hệ thống, khách có tài khoản hoặc vãng lai; không tự xác nhận đã thu. |
| N2-W10 | [ ] | Phân công người phụ trách đơn | Chọn người hợp lệ, lưu; không đổi thành chức năng quản lý nhân viên. |
| N2-W11 | [ ] | Xác nhận đơn | MOI sang XAC_NHAN khi đủ điều kiện; xử lý yêu cầu lặp/phiên bản. |
| N2-W12 | [ ] | Chuẩn bị hàng | XAC_NHAN sang DANG_CHUAN_BI; kiểm tra điều kiện hiện hành. |
| N2-W13 | [ ] | Xuất hàng theo đơn | Danh sách đơn đủ điều kiện, chọn kho/dòng theo mã; xác nhận xuất và cập nhật tồn/lịch sử. |
| N2-W14 | [ ] | Hoàn thành đơn | Chỉ trạng thái và điều kiện giao/thu tiền theo transaction hiện tại, không bỏ qua kiểm tra. |
| N2-W15 | [ ] | Nhân viên hủy đơn | Chỉ trạng thái được hủy; kiểm tra khoản thu/hoàn và giải phóng reservation theo mã. |
| N2-W16 | [ ] | Tra cứu hóa đơn và giao dịch | Xem chi tiết sản phẩm, số tiền, thuế/giảm, người lập và các khoản thanh toán của đơn. |
| N2-W17 | [ ] | Xem trước hóa đơn từ đơn hàng | Lấy dữ liệu đã chốt trên đơn, thông tin người mua và tổng; không yêu cầu nhập lại dòng hàng. |
| N2-W18 | [ ] | Lập hóa đơn | Kiểm tra chưa có hóa đơn; backend chốt lại và lưu transaction; không tạo trùng hóa đơn đã có. |
| N2-W19 | [ ] | In hóa đơn | Từ bản in hóa đơn hiện có; không tự coi thao tác in trình duyệt là đã có API xuất PDF. |
| N2-W20 | [ ] | Ghi nhận khoản thu | Hóa đơn/số còn phải thu, phương thức, mã đối soát; chỉ ghi khoản đã xác nhận thực tế. |
| N2-W21 | [ ] | Ghi nhận hoàn tiền | Số được hoàn, phương thức, đối soát và chống hoàn trùng; không chuyển tiền ngân hàng tự động. |
| N2-W22 | [ ] | Tiếp nhận và đối chiếu yêu cầu liên kết hóa đơn | Đọc ticket, khách, hóa đơn và phiên bản; chỉ đơn tại quầy chưa có chủ. |
| N2-W23 | [ ] | Chấp nhận liên kết hóa đơn | Xác minh chứng từ, ghi chú, khóa/kiểm tra phiên bản; gắn đúng khách, không đổi tiền/tồn. |
| N2-W24 | [ ] | Từ chối liên kết hóa đơn | Ghi lý do và phản hồi cho khách; không cấp quyền xem đơn. |
| N2-W25 | [ ] | Tra cứu chương trình khuyến mãi | Danh sách, chi tiết, thời gian, trạng thái và voucher liên quan. |
| N2-W26 | [ ] | Tạo chương trình khuyến mãi | Thông tin, thời gian và trạng thái hợp lệ. |
| N2-W27 | [ ] | Sửa chương trình khuyến mãi | Thay đổi thông tin/thời gian khi được phép, lưu và kiểm tra kết quả. |
| N2-W28 | [ ] | Đổi trạng thái chương trình | Bật/tạm ngừng theo giá trị hiện tại; hoạt động không đồng nghĩa đang trong thời gian áp dụng. |
| N2-W29 | [ ] | Quản lý banner khuyến mãi | Tải/thay/gỡ ảnh hoặc URL theo form hiện có; đối chiếu vị trí hiển thị khách hàng. |
| N2-W30 | [ ] | Tra cứu voucher và lượt sử dụng | Theo mã/chương trình/trạng thái; xem giới hạn và các lượt dùng liên quan. |
| N2-W31 | [ ] | Tạo voucher | Chương trình, mã, loại/mức giảm, đơn tối thiểu, mức trần và quota theo schema. |
| N2-W32 | [ ] | Sửa voucher và đổi trạng thái | Sửa điều kiện hợp lệ, bật/ngừng; giữ dữ liệu sử dụng và kiểm tra ảnh hưởng ở checkout. |

### Sequence

| Mã | Xong | Tình huống | Workflow liên quan | Nội dung phải thể hiện |
| --- | --- | --- | --- | --- |
| N2-S01 | [ ] | Tạo/sửa hồ sơ khách hàng | N2-W02, N2-W03 | Kiểm tra dữ liệu và ghi hồ sơ; không trộn với tạo tài khoản admin. |
| N2-S02 | [ ] | Xóa mềm và khôi phục hồ sơ khách | N2-W04, N2-W05 | Hai nhánh trạng thái, kiểm tra quyền, giữ lịch sử và không tự mở tài khoản. |
| N2-S03 | [ ] | Tạo đơn bán tại quầy | N2-W08, N2-W09 | Email, ownership nếu chọn khách, dòng hàng và idempotency trong transaction. |
| N2-S04 | [ ] | Phân công và chuyển trạng thái xử lý đơn | N2-W10, N2-W11, N2-W12 | Có thể dùng alt theo thao tác; kiểm tra người/trạng thái và phiên bản. |
| N2-S05 | [ ] | Xuất hàng theo đơn | N2-W13 | Kiểm tra đơn và tồn, cập nhật dòng xuất/lịch sử một lần. |
| N2-S06 | [ ] | Hoàn thành đơn | N2-W14 | Kiểm tra trạng thái và điều kiện tài chính/giao hàng theo mã hiện tại. |
| N2-S07 | [ ] | Nhân viên hủy đơn | N2-W15 | Ownership nghiệp vụ, trạng thái và xử lý hàng giữ; khác với quyền khách tự hủy. |
| N2-S08 | [ ] | Xem trước và phát hành hóa đơn | N2-W17, N2-W18 | Preview chỉ đọc; ghi hóa đơn bằng transaction, giữ tính duy nhất theo đơn. |
| N2-S09 | [ ] | Ghi nhận khoản thu | N2-W20 | Giới hạn phải thu, đối soát/idempotency, cập nhật bút toán. |
| N2-S10 | [ ] | Ghi nhận hoàn tiền | N2-W21 | Giới hạn được hoàn và chống hoàn trùng; không có bước chuyển tiền thật nếu chưa tích hợp. |
| N2-S11 | [ ] | Quyết định liên kết hóa đơn | N2-W22, N2-W23, N2-W24 | Approve/reject, khóa đơn/ticket và chống chuyển đơn đã có chủ. |
| N2-S12 | [ ] | Lưu chương trình/voucher và kiểm tra điều kiện | N2-W26, N2-W27, N2-W28, N2-W31, N2-W32 | Nhánh theo đối tượng, kiểm tra chương trình và hạn mức; không vẽ thành áp mã tại checkout. |

### Mã nguồn đối chiếu

- [ui/adminUI/src/features/customers/](../ui/adminUI/src/features/customers/)
- [ui/warehouseUI/src/features/invoice-claims/](../ui/warehouseUI/src/features/invoice-claims/)
- [ui/warehouseUI/src/features/internal/dispatch-orders.tsx](../ui/warehouseUI/src/features/internal/dispatch-orders.tsx)
- [ui/adminUI/src/features/operations/operation-panel.tsx](../ui/adminUI/src/features/operations/operation-panel.tsx)
- [ui/adminUI/src/features/operations/invoice-creator.tsx](../ui/adminUI/src/features/operations/invoice-creator.tsx)
- [ui/adminUI/src/features/operations/order-payment-fields.tsx](../ui/adminUI/src/features/operations/order-payment-fields.tsx)
- [ui/adminUI/src/features/operations/invoice-print.tsx](../ui/adminUI/src/features/operations/invoice-print.tsx)
- [ui/adminUI/src/features/forms/promotion-banner.tsx](../ui/adminUI/src/features/forms/promotion-banner.tsx)
- [Backend/phub_api/controllers/crm.py](../Backend/phub_api/controllers/crm.py)
- [Backend/phub_api/controllers/admin_operations.py](../Backend/phub_api/controllers/admin_operations.py)
- [Backend/phub_api/controllers/invoice_claims.py](../Backend/phub_api/controllers/invoice_claims.py)

Lần theo controller → service → repository → migration đúng nghiệp vụ. Có file hoặc nút UI không có nghĩa đường chạy đã được kiểm thử end-to-end.

### Điểm lệch cần ghi chú, chưa mô tả thành công

| Mã | Vấn đề | Bằng chứng/phạm vi |
| --- | --- | --- |
| N2-G01 | Khóa/mở tài khoản khách từ hồ sơ nhân viên | customer-detail.tsx/customer-status-cell.tsx gọi /api/admin/accounts/{id}/status; dependency admin_accounts.py yêu cầu ADMIN. Đây là lệch UI/quyền API: không giao nhân viên sơ đồ khóa tài khoản thành công. Quyền quản lý tài khoản vẫn thuộc admin. |

## Người 3 — Khách hàng — tài khoản, địa chỉ và mua hàng

**Người nhận:** [Điền tên] · **Bàn giao:** 34 Workflow + 12 Sequence = 46 sơ đồ.

### Workflow

| Mã | Xong | Chức năng | Điều kiện/nội dung phải thể hiện |
| --- | --- | --- | --- |
| N3-W01 | [ ] | Đăng ký tài khoản khách | Nhập tên/username/email/mật khẩu, kiểm tra trùng, tạo hồ sơ và phiên; chưa gửi OTP. |
| N3-W02 | [ ] | Đăng nhập khách hàng | Kiểm tra thông tin/trạng thái, redirect an toàn và cập nhật phiên. |
| N3-W03 | [ ] | Đăng xuất khách hàng | Gọi backend xóa cookie, cập nhật danh tính giỏ và giao diện; xử lý lỗi. |
| N3-W04 | [ ] | Xem và cập nhật hồ sơ cá nhân | Thông tin liên hệ, ngày sinh; chỉ dữ liệu thuộc khách đang đăng nhập. |
| N3-W05 | [ ] | Thay ảnh đại diện | Chọn ảnh, kiểm tra định dạng/kích thước, tải và cập nhật liên kết hồ sơ. |
| N3-W06 | [ ] | Xem sổ địa chỉ | Danh sách địa chỉ của chính khách, nhận biết địa chỉ mặc định. |
| N3-W07 | [ ] | Thêm địa chỉ nhận hàng | Tên, điện thoại và địa chỉ; validation và ownership. |
| N3-W08 | [ ] | Sửa địa chỉ nhận hàng | Đúng chủ sở hữu, kiểm tra dữ liệu và lưu. |
| N3-W09 | [ ] | Xóa địa chỉ nhận hàng | Xác nhận và xử lý địa chỉ mặc định theo quy tắc API. |
| N3-W10 | [ ] | Đặt địa chỉ mặc định | Dùng trường mặc định trong form địa chỉ hiện có; không tự thêm endpoint giả. |
| N3-W11 | [ ] | Duyệt trang chủ và danh mục | Banner, thương hiệu, nhóm loại/loại con và danh sách sản phẩm. |
| N3-W12 | [ ] | Tìm kiếm sản phẩm | Tìm theo tên/mã và mở kết quả; trạng thái đang tải/rỗng/lỗi. |
| N3-W13 | [ ] | Lọc và sắp xếp sản phẩm | Dropdown liên quan loại sản phẩm, nút áp dụng bên ngoài; bỏ lọc và sắp xếp. |
| N3-W14 | [ ] | Xem chi tiết sản phẩm | Gallery, mô tả/thông số mở rộng, giá, thương hiệu, lượng còn và đánh giá công khai. |
| N3-W15 | [ ] | Kiểm tra trạng thái bán và tồn khi mua | Ẩn/tạm ngừng/hết hàng; chặn nhập vượt tổng khả dụng trừ lượng đã có trong giỏ. |
| N3-W16 | [ ] | Thêm vào giỏ khi chưa đăng nhập | Lưu giỏ khách trên trình duyệt, vẫn kiểm tra hàng; không tạo đơn/hóa đơn/reservation. |
| N3-W17 | [ ] | Thêm vào giỏ khi đã đăng nhập | Giỏ theo danh tính khách, chống gửi lặp cùng món và không khóa nút của mọi sản phẩm. |
| N3-W18 | [ ] | Sửa số lượng trong giỏ | Số nguyên dương, tổng nhu cầu theo SKU, giới hạn theo dữ liệu thực tế; không trần 99/1.000. |
| N3-W19 | [ ] | Chọn hoặc xóa sản phẩm trong giỏ | Chọn dòng để đặt, xóa dòng; tổng tiền tính theo các dòng được chọn. |
| N3-W20 | [ ] | Gộp giỏ sau đăng nhập | Chuyển từ giỏ khách sang giỏ tài khoản, giữ số lượng/lựa chọn và kiểm tra tồn. |
| N3-W21 | [ ] | Mua ngay | Thêm một món bằng logic giỏ rồi mở giỏ; không tự giữ/trừ tồn hoặc tạo đơn. |
| N3-W22 | [ ] | Xem danh sách voucher phù hợp | Hiệu lực và mức giảm thực tế; sắp ưu tiên mã dùng được, giải thích mã chưa áp dụng được. |
| N3-W23 | [ ] | Áp dụng hoặc bỏ voucher | Nhập/chọn mã, báo giá lại, chỉ báo thành công sau xác nhận; giảm trước VAT theo logic đã chốt. |
| N3-W24 | [ ] | Tiếp tục đặt hàng từ giỏ | Chặn khi chưa chọn món/đang thêm hàng, xác thực đăng nhập và kiểm tra lại tồn. |
| N3-W25 | [ ] | Chọn nhận hàng tận nơi hoặc tại cửa hàng | Chọn/thêm địa chỉ khi giao; nhận tại cửa hàng chỉ thông tin cần thiết, không bắt địa chỉ cửa hàng. |
| N3-W26 | [ ] | Xem báo giá trước đặt hàng | Giá dòng, giảm, VAT và tổng sau thuế; báo giá chưa giữ hàng. |
| N3-W27 | [ ] | Xác nhận đặt hàng | Transaction kiểm tra lại, phân bổ nhiều kho hoạt động, tạo đơn và hóa đơn đồng thời; rollback nếu lỗi. |
| N3-W28 | [ ] | Xem kết quả đặt hàng và hóa đơn | Mã đơn, thông tin nhận, nhóm dòng cùng SKU/giá, tổng tiền và thời hạn. |
| N3-W29 | [ ] | Yêu cầu thanh toán | Chọn phương thức, gửi yêu cầu và xử lý chưa tích hợp/demo theo cấu hình; không mặc định thành công. |
| N3-W30 | [ ] | Theo dõi trạng thái thanh toán | Đọc khoản thu/giao dịch, đang chờ/thất bại/thành công, không nhấn refresh là tự thu tiền. |
| N3-W31 | [ ] | Xem lịch sử và chi tiết đơn | Đơn gần đây, lịch sử phân trang, chi tiết thuộc mình, hóa đơn và thanh toán. |
| N3-W32 | [ ] | Khách chủ động hủy đơn | Xác nhận; chỉ MOI/XAC_NHAN/DANG_CHUAN_BI; khoản thu thực tế còn lại cần nhân viên xử lý hoàn trước. |
| N3-W33 | [ ] | Hết hạn thanh toán 24 giờ | Tiến trình hệ thống kiểm tra đối tượng; hủy đơn đủ điều kiện và nhả reservation, không tăng tồn vật lý. |
| N3-W34 | [ ] | Tra cứu thông tin giới thiệu và FAQ | Trang nội dung tĩnh và điều hướng; không dựng Sequence truy vấn DB cho nội dung không dùng DB. |

### Sequence

| Mã | Xong | Tình huống | Workflow liên quan | Nội dung phải thể hiện |
| --- | --- | --- | --- | --- |
| N3-S01 | [ ] | Đăng ký khách và tạo phiên | N3-W01 | Tạo hồ sơ/tài khoản trong transaction, trả cookie; không gửi email/OTP. |
| N3-S02 | [ ] | Đăng nhập và gộp giỏ theo danh tính | N3-W02, N3-W20 | Tách cookie backend và giỏ trình duyệt; không tin role từ localStorage. |
| N3-S03 | [ ] | Lưu hồ sơ và ảnh đại diện | N3-W04, N3-W05 | Ownership, kiểm tra ảnh, Storage và cập nhật liên kết; không thêm ảnh thật khi chỉ vẽ. |
| N3-S04 | [ ] | Thêm/sửa địa chỉ và địa chỉ mặc định | N3-W07, N3-W08, N3-W10 | Kiểm tra chủ sở hữu, duy trì mặc định theo RPC; dùng alt thêm/sửa. |
| N3-S05 | [ ] | Xóa địa chỉ | N3-W09 | Ownership và quy tắc địa chỉ mặc định. |
| N3-S06 | [ ] | Tìm/lọc catalog và lấy chi tiết | N3-W12, N3-W13, N3-W14 | Tách dữ liệu đã tải với truy vấn API, không mô tả tất cả tìm kiếm đều ở RAM. |
| N3-S07 | [ ] | Thêm/sửa giỏ và kiểm tra tồn | N3-W15, N3-W16, N3-W17, N3-W18, N3-W21 | Xác minh tổng lượng theo SKU, snapshot giỏ/danh tính và các yêu cầu đồng thời. |
| N3-S08 | [ ] | Báo giá và áp dụng voucher | N3-W22, N3-W23, N3-W26 | Điều kiện mã/chương trình/quota, phân bổ giảm và thuế; không giữ hàng. |
| N3-S09 | [ ] | Transaction đặt hàng và tạo hóa đơn | N3-W24, N3-W25, N3-W27 | Idempotency, phân bổ nhiều kho hoạt động, ownership, hóa đơn cùng transaction và rollback. |
| N3-S10 | [ ] | Xem hóa đơn và theo dõi thanh toán | N3-W28, N3-W29, N3-W30, N3-W31 | Yêu cầu không đồng nghĩa đã trả tiền; nhánh demo phải ghi rõ. |
| N3-S11 | [ ] | Khách hủy đơn | N3-W32 | Trạng thái, ownership, khoản thu; nhả reservation và giữ chứng từ. |
| N3-S12 | [ ] | Hủy tự động do quá hạn | N3-W33 | Actor là tác vụ hệ thống, kiểm tra hóa đơn/hạn/thu tiền; không chỉ dựa đồng hồ UI. |

### Mã nguồn đối chiếu

- [docs/USER-COMMERCE-LOGIC.md](../docs/USER-COMMERCE-LOGIC.md)
- [docs/KAN-61-PAYMENT-DEADLINE.md](../docs/KAN-61-PAYMENT-DEADLINE.md)
- [docs/STORE-PICKUP.md](../docs/STORE-PICKUP.md)
- [ui/userUI/Frontend/src/app/auth/](../ui/userUI/Frontend/src/app/auth/)
- [ui/userUI/Frontend/src/app/main/profile/](../ui/userUI/Frontend/src/app/main/profile/)
- [ui/userUI/Frontend/src/app/main/product/](../ui/userUI/Frontend/src/app/main/product/)
- [ui/userUI/Frontend/src/components/shopping/](../ui/userUI/Frontend/src/components/shopping/)
- [ui/userUI/Frontend/src/app/cart/](../ui/userUI/Frontend/src/app/cart/)
- [ui/userUI/Frontend/src/app/checkout/](../ui/userUI/Frontend/src/app/checkout/)
- [Backend/phub_api/controllers/auth.py](../Backend/phub_api/controllers/auth.py)
- [Backend/phub_api/controllers/commerce.py](../Backend/phub_api/controllers/commerce.py)
- [Backend/phub_api/controllers/orders.py](../Backend/phub_api/controllers/orders.py)
- [Backend/phub_api/controllers/payments.py](../Backend/phub_api/controllers/payments.py)

Lần theo controller → service → repository → migration đúng nghiệp vụ. Có file hoặc nút UI không có nghĩa đường chạy đã được kiểm thử end-to-end.

## Người 4 — CRM hai phía — hỗ trợ, khảo sát, đánh giá và sở thích

**Người nhận:** [Điền tên] · **Bàn giao:** 27 Workflow + 12 Sequence = 39 sơ đồ.

### Workflow

| Mã | Xong | Chức năng | Điều kiện/nội dung phải thể hiện |
| --- | --- | --- | --- |
| N4-W01 | [ ] | Khách gửi yêu cầu hỗ trợ hoặc phản hồi sản phẩm | Đăng nhập, nội dung/chủ đề và sản phẩm/đơn nếu có; lưu ticket thuộc mình. |
| N4-W02 | [ ] | Khách xem lịch sử yêu cầu và phản hồi | Danh sách/chi tiết ticket, trạng thái, lịch sử hội thoại; không thấy ghi chú nội bộ. |
| N4-W03 | [ ] | Khách gửi thêm tin nhắn | Đúng ticket của mình, nội dung hợp lệ, chống gửi trùng và làm mới hội thoại. |
| N4-W04 | [ ] | Nhân viên tra cứu yêu cầu hỗ trợ | Tìm/lọc/trạng thái/ưu tiên, phân trang và mở chi tiết. |
| N4-W05 | [ ] | Nhân viên tiếp nhận và cập nhật ưu tiên | Chọn xử lý/ưu tiên theo UI, lưu người xử lý và trạng thái. |
| N4-W06 | [ ] | Nhân viên gửi phản hồi | Tin nhắn hội thoại, ownership nội bộ và kết quả trả cho khách. |
| N4-W07 | [ ] | Nhân viên cập nhật trạng thái hoặc đóng yêu cầu | Kiểm tra chuyển trạng thái theo API; giữ lịch sử trao đổi. |
| N4-W08 | [ ] | Khách gửi yêu cầu liên kết hóa đơn cũ | Nhập mã hóa đơn và chứng cứ; chưa tự cho xem đơn. Chuyển cho Người 2 vẽ xác minh/quyết định. |
| N4-W09 | [ ] | Nhân viên tra cứu và xem khảo sát | Danh sách, trạng thái, chi tiết câu hỏi và đối tượng. |
| N4-W10 | [ ] | Tạo khảo sát nháp | Tiêu đề, hạn, loại câu hỏi, bắt buộc/tùy chọn, đáp án và nhóm sở thích. |
| N4-W11 | [ ] | Sửa khảo sát nháp | Sửa cấu trúc/câu hỏi/lựa chọn khi còn được phép; bảo vệ thay đổi chưa lưu. |
| N4-W12 | [ ] | Chọn đối tượng nhận khảo sát | Tất cả/theo tuổi/chọn thêm-loại khách theo giao diện hiện có; kiểm tra hồ sơ hợp lệ. |
| N4-W13 | [ ] | Xem trước đối tượng gửi | Danh sách dự kiến/phân trang; phân biệt preview với tập đã phát hành. |
| N4-W14 | [ ] | Phát hành và gửi khảo sát | Chốt câu hỏi/đối tượng, tạo lượt giao đến tài khoản phù hợp; gửi trong ứng dụng, không mặc định có email. |
| N4-W15 | [ ] | Đóng khảo sát | Xác nhận, kiểm tra phiên bản và giữ kết quả; chặn nộp bài mới theo điều kiện. |
| N4-W16 | [ ] | Khách nhận và mở khảo sát | Chỉ khảo sát được giao, hạn/trạng thái/bài đã gửi; nằm trong giao diện hồ sơ. |
| N4-W17 | [ ] | Khách nhập câu trả lời | Một/nhiều lựa chọn, văn bản, thang điểm và mục Khác theo loại câu hỏi. |
| N4-W18 | [ ] | Khách nộp khảo sát | Kiểm tra câu bắt buộc, quyền nhận và hạn; gửi toàn bộ bài một lần, retry không tạo bài trùng. |
| N4-W19 | [ ] | Khách xem bài khảo sát đã gửi | Hiển thị bài thuộc mình và trạng thái đã hoàn thành. |
| N4-W20 | [ ] | Nhân viên xem thống kê và bài khảo sát | Kết quả từng câu, tỷ lệ/đếm, lọc khách và văn bản/Khác, phân trang; không vẽ lại báo cáo admin. |
| N4-W21 | [ ] | Khách xem sản phẩm đủ điều kiện đánh giá | Theo sản phẩm đã mua và đơn đủ điều kiện; một đánh giá/khách/sản phẩm theo API hiện tại. |
| N4-W22 | [ ] | Khách đăng đánh giá sản phẩm | Điểm sao và nội dung, kiểm tra đơn/sản phẩm và ownership. |
| N4-W23 | [ ] | Khách sửa đánh giá đã đăng | Đúng chủ, một bản ghi; giữ ẩn nếu đã bị nhân viên ẩn theo quy tắc. |
| N4-W24 | [ ] | Nhân viên tìm sản phẩm và xem đánh giá | Theo sản phẩm hoặc tất cả, tìm sản phẩm, lọc trạng thái và phân trang. |
| N4-W25 | [ ] | Nhân viên ẩn đánh giá | Xác nhận/phiên bản nội dung, lý do nếu schema yêu cầu; đánh giá không xuất hiện công khai. |
| N4-W26 | [ ] | Nhân viên hiện lại đánh giá | Kiểm tra phiên bản, cập nhật hiển thị; không tạo đánh giá giả mới. |
| N4-W27 | [ ] | Tra cứu sở thích và nhu cầu khách | Lọc khảo sát/tuổi/khách, tổng hợp và câu trả lời; dữ liệu từ nhóm câu hỏi sở thích của bài đã nộp. |

### Sequence

| Mã | Xong | Tình huống | Workflow liên quan | Nội dung phải thể hiện |
| --- | --- | --- | --- | --- |
| N4-S01 | [ ] | Khách tạo yêu cầu hỗ trợ | N4-W01 | Xác thực, ownership và lưu ticket; phản hồi định dạng/thiếu thông tin. |
| N4-S02 | [ ] | Trao đổi tin nhắn khách - nhân viên | N4-W02, N4-W03, N4-W06 | Lưu từng tin nhắn, chống gửi trùng và chỉ trả phần dữ liệu được phép. |
| N4-S03 | [ ] | Nhân viên nhận xử lý, ưu tiên và đóng ticket | N4-W04, N4-W05, N4-W07 | Kiểm tra quyền/trạng thái và lưu lịch sử theo API hiện tại. |
| N4-S04 | [ ] | Khách yêu cầu liên kết hóa đơn | N4-W08 | Lưu ticket mà không tiết lộ hóa đơn có tồn tại hay cấp quyền đơn; nối N2-S11. |
| N4-S05 | [ ] | Tạo và sửa khảo sát nháp | N4-W10, N4-W11 | Lưu câu hỏi/đáp án đúng transaction và phiên bản, không sửa khảo sát đã chốt. |
| N4-S06 | [ ] | Tính đối tượng và xem trước khảo sát | N4-W12, N4-W13 | Lấy hồ sơ đủ điều kiện, tuổi và chọn thêm/loại; chưa gửi. |
| N4-S07 | [ ] | Phát hành khảo sát | N4-W14 | Tính lại đối tượng trong transaction, chốt cấu trúc và tạo lượt giao. |
| N4-S08 | [ ] | Đóng khảo sát | N4-W15 | Khóa/kiểm tra phiên bản, chặn bài nộp sau khi đóng theo transaction. |
| N4-S09 | [ ] | Khách nộp bài khảo sát | N4-W16, N4-W17, N4-W18, N4-W19 | Kiểm tra quyền nhận, hạn, cấu trúc đáp án; submission_id chống nộp trùng. |
| N4-S10 | [ ] | Đăng và sửa đánh giá sản phẩm | N4-W21, N4-W22, N4-W23 | Điều kiện đã mua/đơn đủ điều kiện, ownership, giữ một đánh giá và giữ ẩn nếu đã bị ẩn. |
| N4-S11 | [ ] | Ẩn và hiện lại đánh giá | N4-W24, N4-W25, N4-W26 | Guard nhân viên, phiên bản và cập nhật hiển thị. |
| N4-S12 | [ ] | Tổng hợp kết quả và sở thích từ bài khảo sát | N4-W20, N4-W27 | Chỉ bài đã gửi; nhóm câu hỏi đúng, bộ lọc và phân trang; không tạo bảng sở thích tưởng tượng. |

### Mã nguồn đối chiếu

- [ui/adminUI/src/features/support/](../ui/adminUI/src/features/support/)
- [ui/adminUI/src/features/operations/support-thread.tsx](../ui/adminUI/src/features/operations/support-thread.tsx)
- [ui/adminUI/src/features/engagement/](../ui/adminUI/src/features/engagement/)
- [ui/userUI/Frontend/src/app/contact-us/](../ui/userUI/Frontend/src/app/contact-us/)
- [ui/userUI/Frontend/src/components/engagement/](../ui/userUI/Frontend/src/components/engagement/)
- [ui/userUI/Frontend/src/app/main/profile/AccountDashboard.tsx](../ui/userUI/Frontend/src/app/main/profile/AccountDashboard.tsx)
- [Backend/phub_api/controllers/support.py](../Backend/phub_api/controllers/support.py)
- [Backend/phub_api/controllers/engagement.py](../Backend/phub_api/controllers/engagement.py)
- [Backend/phub_api/services/support.py](../Backend/phub_api/services/support.py)
- [Backend/phub_api/services/engagement.py](../Backend/phub_api/services/engagement.py)
- [docs/COUNTER-INVOICE-LINKING.md](../docs/COUNTER-INVOICE-LINKING.md)
- [docs/CRM-SURVEYS-REVIEWS.md](../docs/CRM-SURVEYS-REVIEWS.md)

Lần theo controller → service → repository → migration đúng nghiệp vụ. Có file hoặc nút UI không có nghĩa đường chạy đã được kiểm thử end-to-end.

## Sơ đồ tổng thể theo đề đồ án

Các hình sau **tách khỏi 171 Workflow/Sequence trên**:

| Mã | Sơ đồ | Người tổng hợp | Tính chất |
| --- | --- | --- | --- |
| T-01 | BFD — phân rã chức năng toàn PHUB | Người 1 | Bắt buộc theo đề; ghép phần admin đã có và các nhóm còn lại |
| T-02 | Sơ đồ ngữ cảnh PHUB | Người 2 | Bắt buộc theo đề; thống nhất tác nhân và luồng dữ liệu ngoài hệ thống |
| T-03 | DFD mức đỉnh | Người 3 | Bắt buộc theo đề; khớp tiến trình, luồng và kho dữ liệu với BFD/ERD |
| T-04 | DFD phân rã CRM | Người 4 | Bổ sung để giải thích hỗ trợ/khảo sát/đánh giá; đề không bắt buộc mức này |
| T-05 | ERD/lược đồ CSDL | Chủ dự án | Phần bạn nhận; đi kèm bảng mô tả bảng/thuộc tính theo đề |

Mỗi người thêm một đầu việc tổng hợp; T-04 là bổ sung. Nếu nhóm đã có hình tổng thể, cập nhật bản đó thay vì tạo bộ trùng lặp. Bảng mô tả CSDL là tài liệu kèm ERD, không tự tính thêm là sơ đồ chức năng.

## Quy tắc nghiệp vụ dùng chung

1. **Quyền:** admin giữ thống kê/tài khoản/nhân viên; nhân viên vận hành. Không khôi phục giới hạn đọc theo kho của tài khoản. UI gọi sai quyền API ghi vào mục lệch, không vẽ thành công giả.
2. **Tồn:** phân biệt tồn vật lý, hàng giữ và tồn khả dụng. Giỏ, mua ngay và báo giá không giữ/trừ tồn. Quy tắc reservation theo `docs/USER-COMMERCE-LOGIC.md`.
3. **Checkout:** gom tồn mọi kho hoạt động, không trần nghiệp vụ 99/1.000. Dòng DB tách kho, chỉ hiển thị mới gộp theo SKU/đơn vị/giá. Đơn và hóa đơn cùng transaction, lỗi rollback.
4. **Chứng từ:** hóa đơn không đồng nghĩa đã trả tiền. Phiếu nhập nháp chưa cộng tồn; xác nhận chỉ cập nhật một lần. Xuất theo đơn, không thêm phiếu xuất nháp độc lập.
5. **Thanh toán:** yêu cầu/đang chờ khác khoản thu thành công. Ghi sổ thu/hoàn không có nghĩa chuyển tiền thật; nhánh bypass phải ghi là mô phỏng.
6. **Voucher:** kiểm tra chương trình, thời gian, trạng thái, đơn và quota; giảm trước VAT theo quyết định hiện tại. Không tự sửa chính sách sử dụng lại mã khi vẽ.
7. **Hủy:** khách, nhân viên và tác vụ quá hạn có actor/endpoint/guard riêng. Nhả hàng giữ không tăng tồn vật lý, không xóa chứng từ, không bỏ qua khoản thu cần hoàn.
8. **CRM:** chỉ bài đã gửi được thống kê; sở thích lấy đúng nhóm câu hỏi. Đánh giá kiểm tra điều kiện đã mua; ẩn khác xóa.
9. **Hiện trạng:** OTP/xác minh email, gửi email khảo sát và tự ghép đơn vãng lai theo email đang tạm gác. Không đưa vào sơ đồ thành công hiện tại.
10. **Lỗi:** thiếu endpoint/migration, sai quyền hoặc dữ liệu API không hợp lệ cần nhánh lỗi và nguồn kiểm chứng. Không hiển thị dữ liệu giả thay lỗi.

## Ngoài phạm vi hiện tại

- Chuyển kho và phiếu xuất nháp riêng.
- Nhân viên quản lý mọi tài khoản, phân quyền hay quản lý nhân viên.
- OTP/email xác minh, tự liên kết đơn cũ bằng email, quên mật khẩu qua email.
- Wishlist, so sánh, đăng ký bản tin hoặc đổi mật khẩu khách khi chưa có luồng đang chạy.
- Cổng ngân hàng/vận chuyển thật ngoài tích hợp hiện có; API xuất PDF nếu UI chỉ in bằng trình duyệt.
- Chức năng trong file cũ không còn được route hiện tại sử dụng.

<a id="quy-uoc-ve-va-nghiem-thu"></a>
## Quy ước vẽ và nghiệm thu

1. **Workflow:** bắt đầu/kết thúc, actor, dữ liệu nhập, điều kiện, xử lý và kết quả; nhánh lỗi/rỗng/hủy cần thiết. Có thể dùng swimlane cho nhiều vai trò.
2. **Sequence:** Người dùng → Giao diện → Controller → Service → Repository → Database. Gộp Next gateway vào Giao diện cho gọn; thêm Storage hoặc tác vụ hệ thống khi đúng luồng. Không vẽ UI gọi DB trực tiếp trái mã thực tế.
3. Số ghi trong nội dung thông điệp: `1. Gửi yêu cầu`, không dùng `autonumber`; mỗi sơ đồ bắt đầu từ 1.
4. Nền trắng, chữ/viền đen; nhãn không có nền tối. Kiểm tra bản in trắng đen.
5. Mỗi mã nộp nguồn Mermaid `.mmd` hoặc `.drawio` chỉnh sửa được và bản SVG/PDF. Ví dụ `N1-W27-xac-nhan-nhap-kho.mmd`.
6. Kèm mô tả ngắn: actor, tiền điều kiện, hậu điều kiện, lỗi và file/endpoint tham chiếu. Nếu quá chật tách hình hậu tố a/b cùng mã.
7. Chỉ đánh dấu xong sau khi đối chiếu mã và kiểm tra hình xuất đọc được.
8. Không chạy giao dịch thật, đổi mật khẩu, hủy đơn, sửa tồn/DB để minh họa. Dùng mô tả mã hoặc fixtures.
9. Đổi chéo hình giữa các nhóm tại các điểm nối trước khi ghép báo cáo và đối chiếu ERD.
10. Đề không yêu cầu 171 Workflow/Sequence. Bộ này để chia đủ việc; chọn hình chính cho thân báo cáo, chi tiết cho phụ lục.

## Trình tự làm

- Điền tên người nhận và chốt quyền/trạng thái/tồn/thuế trước.
- Đọc nguồn tương ứng; ghi riêng các điểm lệch được liệt kê.
- Vẽ Workflow thao tác ghi/transaction trước, tra cứu sau.
- Vẽ Sequence theo mã Workflow liên quan và endpoint thật.
- Đối chiếu liên nhóm, tổng hợp BFD/ngữ cảnh/DFD và ERD.
- Rà đánh số, nền đen trắng, xuất hình và hoàn tất checklist.

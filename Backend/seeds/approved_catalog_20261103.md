# Danh sách sản phẩm được duyệt ngày 03/11/2026

Người dùng duyệt bốn mẫu và giá trước VAT trong hội thoại. File SQL cùng tên
chỉ thêm loại con và sản phẩm còn thiếu; không đổi giá hoặc trạng thái bản ghi
đã tồn tại, không tạo phiếu nhập hoặc ghi tồn kho. SKU mới không có dòng tồn
được API tính là khả dụng bằng 0. Mã `SP...` được cấp sau mã lớn nhất hiện có.
SQL chạy toàn bộ trong một transaction và kiểm tra tồn/phiếu nhập không đổi.

| SKU | Giá trước VAT | Trạng thái |
| --- | ---: | --- |
| COR-RAM-LPX-16G-D4-3200 | 890.000đ | 1 — hoạt động, chưa có tồn |
| KIN-SSD-NV3-1TB | 1.490.000đ | 1 — hoạt động, chưa có tồn |
| COR-CASE-4000D-AIRFLOW-BLK | 2.190.000đ | 0 — đã ẩn |
| TR-COOLER-PA120-SE | 890.000đ | 0 — đã ẩn |

Hai loại con mới thuộc `L_LINHKIEN`: `COMPONENT_CASE` (Vỏ máy tính) và
`COMPONENT_COOLING_AIR` (Tản nhiệt khí). Ảnh chính được lấy từ nguồn chính thức
của hãng, tải qua `MediaService.store_image` và gán qua `save_gallery` vào bucket
`media/products` của Phub. SQL lưu URL Storage cuối cùng; gallery có một ảnh chính
mỗi sản phẩm. Next.js dùng cấu hình Supabase ảnh sẵn có. Giá là mức đã được người dùng duyệt,
không phải báo giá được lấy từ các nguồn dưới đây.

Thông số SSD ghi bảo hành hãng 60 tháng. Ba mẫu còn lại giữ mặc định
`bao_hanh_thang=0`, chưa khai báo chính sách bảo hành bằng tháng của cửa hàng;
không chuyển chế độ bảo hành giới hạn trọn đời của RAM thành số tháng tùy ý.

Nguồn tên mẫu, thông số và ảnh:

- [Corsair Vengeance LPX](https://www.corsair.com/us/en/p/memory/cmk16gx4m2b3200c16/vengeancea-lpx-16gb-2-x-8gb-ddr4-dram-3200mhz-c16-memory-kit-black-cmk16gx4m2b3200c16)
- [Kingston NV3 1TB](https://www.kingston.com/en/memory/search?partid=SNV3S%2F1000G)
- [Corsair 4000D Airflow](https://www.corsair.com/us/en/p/pc-cases/cc-9011200-ww/4000d-airflow-tempered-glass-mid-tower-atx-case-black-cc-9011200-ww)
- [Thermalright Peerless Assassin 120 SE](https://www.thermalright.com/product/peerless-assassin-120-se/)

Đã áp dụng lên Phub: SP088 = case ẩn, SP089 = RAM hết hàng, SP090 = SSD hết hàng,
SP091 = tản nhiệt ẩn. API local xác nhận hai mẫu hoạt động có khả dụng bằng 0;
hai mẫu ẩn trả 404 ở URL chi tiết và availability, không xuất hiện trong tìm kiếm.
Các kiểm thử tự động dùng fixtures riêng, không ghi dữ liệu Supabase thật.

Chạy seed không tự deploy backend: bộ lọc catalog cần dùng đúng quy ước
`0=đã ẩn`, `1=hoạt động`, `2=tạm ngừng` như UI admin.

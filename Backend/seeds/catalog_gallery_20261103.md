# Gallery ảnh chính hãng — đợt bổ sung 03/11/2026

Phạm vi: 24 sản phẩm SP092–SP115 vừa nhập vào kho 1. Đã thêm **62 ảnh**, nâng tổng gallery của nhóm này lên **86 ảnh**. Giữ ảnh chính có sẵn, thứ tự ảnh và liên kết tương thích trong `SAN_PHAM.duong_dan_anh`.

Ảnh lấy từ trang sản phẩm/CDN chính thức của hãng, kiểm tra bằng ảnh thực tế rồi tải qua `MediaService` hiện có lên Supabase Storage dưới dạng WebP. Gallery được lưu bằng `admin_product_gallery_v1` với kiểm tra phiên bản; không thay đổi schema, cấu hình bucket hoặc chính sách truy cập.

## Kết quả

- 19 sản phẩm có 4 ảnh; Arctic P12 PWM PST và Logitech Z150 có 3 ảnh.
- WD Blue 1 TB / 2 TB giữ 1 ảnh; Toshiba P300 có 2 ảnh. Chưa tìm được thêm ảnh chính thức phù hợp, không dùng ảnh trùng kích thước hay ảnh khác dung lượng để đủ số lượng.
- API catalog trả đúng số ảnh của cả 24 sản phẩm; cả 86 URL Storage trả HTTP 200 và giải mã thành WebP hợp lệ.
- Playwright kiểm tra 7 mẫu trên desktop và mobile: chọn thumbnail, nút ảnh tiếp theo và thao tác vuốt mobile đều hoạt động. Không phát hiện lỗi JavaScript hoặc lỗi tải ảnh/API catalog. HTTP 401 từ hai endpoint kiểm tra phiên đăng nhập là kết quả bình thường khi duyệt ẩn danh.
- Đối chiếu fingerprint toàn bộ bảng sản phẩm, tồn kho, phiếu nhập, chi tiết phiếu nhập, đơn hàng, hóa đơn và thanh toán trước/sau: giữ nguyên. Không tạo đơn hay ghi thanh toán để kiểm thử gallery.
- Chưa commit hoặc push Git trong tác vụ này. Ảnh và liên kết gallery đã được cập nhật trực tiếp trên Supabase của dự án; kiểm thử giao diện bằng bản local.

## Hồ sơ đối chiếu

- [Manifest nguồn ảnh, checksum, media ID và URL Storage](catalog_gallery_20261103.json).
- [Kết quả kiểm tra và fingerprint trước/sau](catalog_gallery_20261103.verification.json).

## Trang hãng của từng sản phẩm

- SP092 [Vỏ máy Corsair 3000D Airflow màu đen](https://www.corsair.com/ww/en/p/pc-cases/CC-9011251-WW/3000d-tempered-glass-mid-tower-black-cc-9011251-ww) (4 images)
- SP093 [Vỏ máy Corsair 2000D Airflow Mini-ITX màu đen](https://www.corsair.com/us/en/p/pc-cases/cc-9011244-ww/2000d-airflow-mini-itx-pc-case-black-cc-9011244-ww) (4 images)
- SP094 [Vỏ máy Cooler Master MasterBox Q300L](https://www.coolermaster.com/en-us/products/masterbox-q300l.html) (4 images)
- SP095 [Tản nhiệt khí Thermalright Assassin X 120 Refined SE](https://www.thermalright.com/product/assassin-x-120-refined-se/) (4 images)
- SP096 [Tản nhiệt khí Thermalright Assassin King 120 SE](https://www.thermalright.com/product/assassin-king-120-se/) (4 images)
- SP097 [Tản nhiệt khí Thermalright Burst Assassin 120](https://www.thermalright.com/product/burst-assassin-120/) (4 images)
- SP098 [Tản nhiệt nước Thermalright Frozen Notte 240 Black ARGB](https://www.thermalright.com/product/frozen-notte-240-black-argb/) (4 images)
- SP099 [Tản nhiệt nước Thermalright Frozen Notte 360 Black ARGB](https://www.thermalright.com/product/frozen-notte-360-black-argb/) (4 images)
- SP100 [Tản nhiệt nước Thermalright Frozen Prism 240 Black ARGB](https://www.thermalright.com/product/frozen-prism-240-black-argb/) (4 images)
- SP101 [Quạt case Thermalright TL-C12C 120mm PWM](https://www.thermalright.com/product/tl-c12c/) (4 images)
- SP102 [Quạt case Thermalright TL-C12C-S 120mm ARGB](https://www.thermalright.com/product/tl-c12c-s/) (4 images)
- SP103 [Quạt case ARCTIC P12 PWM PST 120mm màu đen](https://www.arctic.de/en/P12-PWM-PST/ACFAN00120A) (3 images)
- SP104 [Ổ cứng HDD WD Blue 1TB WD10EZEX SATA 3.5 inch](https://www.westerndigital.com/en-gb/products/internal-drives/wd-blue-desktop-sata-hdd?sku=WD10EZEX) (1 images)
- SP105 [Ổ cứng HDD WD Blue 2TB WD20EZBX SATA 3.5 inch](https://www.westerndigital.com/en-gb/products/internal-drives/wd-blue-desktop-sata-hdd?sku=WD20EZBX) (1 images)
- SP106 [Ổ cứng HDD Toshiba P300 2TB HDWD120](https://www.toshiba-storage.com/products/toshiba-internal-hard-drives-p300/) (2 images)
- SP107 [Webcam Logitech C270 HD 720p](https://www.logitech.com/en-us/products/webcams/c270-hd-webcam.960-000694.html) (4 images)
- SP108 [Webcam Logitech C920s Pro Full HD 1080p](https://www.logitech.com/en-us/products/webcams/c920-pro-hd-webcam.960-000764.html) (4 images)
- SP109 [Webcam Logitech Brio 100 Full HD 1080p màu graphite](https://www.logitech.com/en-us/products/webcams/brio-100-webcam.960-001580.html) (4 images)
- SP110 [Loa máy tính Logitech S150 USB Stereo](https://www.logi.com/en-us/shop/p/s150-usb-stereo-speakers.980-000028) (4 images)
- SP111 [Loa máy tính Logitech Z150 Stereo màu đen](https://www.logi.com/en-us/shop/p/z150-compact-stereo-speakers.980-000802) (3 images)
- SP112 [Loa máy tính Logitech Z313 2.1 kèm loa siêu trầm](https://www.logitech.com/en-us/products/speakers/z313-speaker-system-subwoofer.980-000382.html) (4 images)
- SP113 [Hub USB TP-Link UH400 4 cổng USB 3.0](https://www.tp-link.com/us/home-networking/usb-hub/uh400/) (4 images)
- SP114 [Hub USB TP-Link UH700 7 cổng USB 3.0](https://www.tp-link.com/us/home-networking/usb-hub/uh700/) (4 images)
- SP115 [Hub USB TP-Link UH720 7 cổng dữ liệu và 2 cổng sạc](https://www.tp-link.com/us/home-networking/usb-hub/uh720/) (4 images)

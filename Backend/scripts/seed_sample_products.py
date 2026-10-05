"""Script to seed 20 realistic sample products and inventory into Supabase.
Run from Phub-platform/Backend:
    .\.venv\Scripts\python.exe scripts/seed_sample_products.py
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add Backend root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.supabase import supabase

PRODUCTS = [
    # --- 1. Điện thoại (SEED_L001) ---
    {
        "ma_sp": "SP_IPHONE15PM",
        "sku": "APL-IP15PM-256",
        "ten_sp": "iPhone 15 Pro Max 256GB Titan Tự Nhiên",
        "ma_loai_sp": "SEED_L001",
        "thuong_hieu": "Apple",
        "gia_ban_hien_tai": 29990000.0,
        "mo_ta": "Thiết kế khung viền titan chuẩn hàng không vũ trụ siêu bền nhẹ, trang bị chip A17 Pro mạnh mẽ cùng camera telephoto 5x đỉnh cao.",
        "thong_so_ky_thuat": json.dumps({
            "Màn hình": "6.7 inch Super Retina XDR OLED 120Hz",
            "Chipset": "Apple A17 Pro (3nm)",
            "RAM": "8 GB",
            "Bộ nhớ trong": "256 GB",
            "Camera sau": "Chính 48MP, Siêu rộng 12MP, Telephoto 5x 12MP",
            "Pin & Sạc": "4422 mAh, Sạc nhanh 20W, MagSafe 15W"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage43.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_S24ULTRA",
        "sku": "SAM-S24U-256",
        "ten_sp": "Samsung Galaxy S24 Ultra 5G 12GB/256GB Xám Titan",
        "ma_loai_sp": "SEED_L001",
        "thuong_hieu": "Samsung",
        "gia_ban_hien_tai": 27490000.0,
        "mo_ta": "Siêu phẩm tích hợp quyền năng Galaxy AI thông minh, camera zoom 100x với cảm biến 200MP, bút S-Pen tiện lợi và viền titan sang trọng.",
        "thong_so_ky_thuat": json.dumps({
            "Màn hình": "6.8 inch Dynamic AMOLED 2X 120Hz",
            "Chipset": "Snapdragon 8 Gen 3 for Galaxy",
            "RAM": "12 GB",
            "Bộ nhớ trong": "256 GB",
            "Camera sau": "200MP + 50MP + 12MP + 10MP",
            "Pin & Sạc": "5000 mAh, Sạc nhanh 45W"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage44.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_XIAOMI14",
        "sku": "XIA-14-512",
        "ten_sp": "Xiaomi 14 5G 12GB/512GB Leica Edition",
        "ma_loai_sp": "SEED_L001",
        "thuong_hieu": "Xiaomi",
        "gia_ban_hien_tai": 19990000.0,
        "mo_ta": "Ống kính quang học Leica Summilux thế hệ mới, vi xử lý Snapdragon 8 Gen 3 đỉnh cao và kích thước nhỏ gọn cầm nắm hoàn hảo.",
        "thong_so_ky_thuat": json.dumps({
            "Màn hình": "6.36 inch AMOLED 1.5K 120Hz CrystalRes",
            "Chipset": "Qualcomm Snapdragon 8 Gen 3",
            "RAM": "12 GB LPDDR5X",
            "Bộ nhớ trong": "512 GB UFS 4.0",
            "Camera": "Cụm 3 camera 50MP tinh chỉnh bởi Leica",
            "Pin & Sạc": "4610 mAh, Sạc nhanh có dây 90W, Không dây 50W"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 18,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage45.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_IPHONE13",
        "sku": "APL-IP13-128",
        "ten_sp": "iPhone 13 128GB Midnight",
        "ma_loai_sp": "SEED_L001",
        "thuong_hieu": "Apple",
        "gia_ban_hien_tai": 13690000.0,
        "mo_ta": "Thiết kế bền bỉ với Ceramic Shield, chip A15 Bionic mượt mà, hệ thống camera kép góc chéo tiên tiến bắt trọn khoảnh khắc.",
        "thong_so_ky_thuat": json.dumps({
            "Màn hình": "6.1 inch Super Retina XDR OLED",
            "Chipset": "Apple A15 Bionic 6 nhân",
            "RAM": "4 GB",
            "Bộ nhớ trong": "128 GB",
            "Camera": "Kép 12MP góc rộng và siêu rộng, quay phim 4K HDR",
            "Kháng nước": "IP68 tiêu chuẩn quốc tế"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage46.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_OPPOFINDN3",
        "sku": "OPP-FN3F-256",
        "ten_sp": "OPPO Find N3 Flip 5G 12GB/256GB Vàng Ánh Kim",
        "ma_loai_sp": "SEED_L001",
        "thuong_hieu": "OPPO",
        "gia_ban_hien_tai": 18990000.0,
        "mo_ta": "Điện thoại gập thời thượng với màn hình ngoài trực quan đa ứng dụng, cụm 3 camera Hasselblad chụp chân dung chuyên nghiệp không góc chết.",
        "thong_so_ky_thuat": json.dumps({
            "Màn hình chính": "6.8 inch FHD+ AMOLED 120Hz LTPO",
            "Màn hình phụ": "3.26 inch AMOLED dọc tiện ích",
            "Chipset": "MediaTek Dimensity 9200 5G",
            "RAM": "12 GB",
            "Bộ nhớ trong": "256 GB",
            "Camera": "Hasselblad 50MP + 32MP + 48MP",
            "Pin & Sạc": "4300 mAh, Sạc siêu nhanh 44W SuperVOOC"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage47.png",
        "trang_thai": 1,
    },

    # --- 2. Máy tính xách tay (SEED_L002) ---
    {
        "ma_sp": "SP_MACBOOKAIRM3",
        "sku": "APL-MBA13-M3-16",
        "ten_sp": "Apple MacBook Air 13 inch M3 16GB / 512GB SSD",
        "ma_loai_sp": "SEED_L002",
        "thuong_hieu": "Apple",
        "gia_ban_hien_tai": 32990000.0,
        "mo_ta": "Siêu mỏng nhẹ với sức mạnh vượt trội từ vi xử lý Apple M3 thế hệ mới, hỗ trợ xuất cùng lúc 2 màn hình ngoài và pin bền bỉ 18 giờ.",
        "thong_so_ky_thuat": json.dumps({
            "CPU": "Apple M3 8-core CPU",
            "GPU": "10-core GPU hỗ trợ Ray Tracing",
            "RAM": "16 GB Unified Memory",
            "Ổ cứng": "512 GB SSD siêu tốc",
            "Màn hình": "13.6 inch Liquid Retina (2560 x 1664)",
            "Trọng lượng": "1.24 kg"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/catalog/prestige-front.webp",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_ASUSROG_G14",
        "sku": "ASU-ROG-G14-OLED",
        "ten_sp": "Laptop ASUS ROG Zephyrus G14 OLED GA403UI",
        "ma_loai_sp": "SEED_L002",
        "thuong_hieu": "ASUS",
        "gia_ban_hien_tai": 48990000.0,
        "mo_ta": "Laptop gaming cao cấp màn hình ROG Nebula OLED 3K 120Hz, chip Ryzen 9 tích hợp NPU AI và card đồ họa RTX 4070 mạnh mẽ trong khung nhôm CNC siêu mỏng.",
        "thong_so_ky_thuat": json.dumps({
            "CPU": "AMD Ryzen 9 8945HS (8 nhân 16 luồng)",
            "GPU": "NVIDIA GeForce RTX 4070 8GB GDDR6",
            "RAM": "32 GB LPDDR5X 6400MHz",
            "Ổ cứng": "1 TB PCIe 4.0 NVMe SSD",
            "Màn hình": "14 inch 3K (2880 x 1800) OLED 120Hz 0.2ms",
            "Trọng lượng": "1.50 kg"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 24,
        "duong_dan_anh": "/images/home/laptop-green.svg",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_MSIMODERN14",
        "sku": "MSI-MOD14-C12M",
        "ten_sp": "Laptop MSI Modern 14 C12MO Core i5-1235U",
        "ma_loai_sp": "SEED_L002",
        "thuong_hieu": "MSI",
        "gia_ban_hien_tai": 12490000.0,
        "mo_ta": "Người bạn đồng hành gọn nhẹ hoàn hảo cho sinh viên và nhân viên văn phòng với bàn phím có đèn LED, hiệu năng ổn định và bản lề mở 180 độ.",
        "thong_so_ky_thuat": json.dumps({
            "CPU": "Intel Core i5-1235U (10 nhân, 12 luồng)",
            "GPU": "Intel Iris Xe Graphics",
            "RAM": "16 GB DDR4 3200MHz",
            "Ổ cứng": "512 GB NVMe M.2 SSD",
            "Màn hình": "14 inch Full HD (1920 x 1080) IPS-Level 60Hz",
            "Trọng lượng": "1.40 kg"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 24,
        "duong_dan_anh": "/images/catalog/ps63-front.webp",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_DELLXPS13",
        "sku": "DEL-XPS13-9340",
        "ten_sp": "Laptop Dell XPS 13 9340 Intel Core Ultra 7",
        "ma_loai_sp": "SEED_L002",
        "thuong_hieu": "Dell",
        "gia_ban_hien_tai": 44990000.0,
        "mo_ta": "Biểu tượng thiết kế tương lai với dải phím cảm ứng điện dung, touchpad liền mạch và màn hình InfinityEdge viền siêu mỏng 4 cạnh.",
        "thong_so_ky_thuat": json.dumps({
            "CPU": "Intel Core Ultra 7 155H (16 nhân, 22 luồng)",
            "GPU": "Intel Arc Graphics",
            "RAM": "16 GB LPDDR5X 7467MHz",
            "Ổ cứng": "512 GB PCIe Gen4 SSD",
            "Màn hình": "13.4 inch FHD+ (1920 x 1200) 120Hz 500 nits",
            "Trọng lượng": "1.19 kg"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/catalog/prestige-angle.webp",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_LENOVOLEGION5",
        "sku": "LEN-LEG5-16IRX9",
        "ten_sp": "Laptop Gaming Lenovo Legion 5 16IRX9 Core i7",
        "ma_loai_sp": "SEED_L002",
        "thuong_hieu": "Lenovo",
        "gia_ban_hien_tai": 36490000.0,
        "mo_ta": "Hệ thống tản nhiệt Legion ColdFront 5.0 đỉnh cao, màn hình 16 inch 165Hz chuẩn màu 100% sRGB mang lại trải nghiệm chiến game đỉnh cao.",
        "thong_so_ky_thuat": json.dumps({
            "CPU": "Intel Core i7-14650HX (16 nhân 24 luồng)",
            "GPU": "NVIDIA GeForce RTX 4060 8GB GDDR6 140W",
            "RAM": "16 GB DDR5 5600MHz (2 khe)",
            "Ổ cứng": "1 TB SSD M.2 PCIe 4.0",
            "Màn hình": "16 inch WQXGA (2560 x 1600) IPS 165Hz G-Sync",
            "Trọng lượng": "2.30 kg"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 24,
        "duong_dan_anh": "/images/home/laptop-red.svg",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_ACERNITROV",
        "sku": "ACE-NITRO-V15",
        "ten_sp": "Laptop Gaming Acer Nitro V 15 ANV15-51-57B2",
        "ma_loai_sp": "SEED_L002",
        "thuong_hieu": "Acer",
        "gia_ban_hien_tai": 19990000.0,
        "mo_ta": "Chiến binh gaming quốc dân trang bị card đồ họa RTX 4050 hỗ trợ công nghệ DLSS 3, thiết kế hầm hố hiện đại cùng âm thanh vòm DTS:X Ultra.",
        "thong_so_ky_thuat": json.dumps({
            "CPU": "Intel Core i5-13420H (8 nhân 12 luồng)",
            "GPU": "NVIDIA GeForce RTX 4050 6GB GDDR6",
            "RAM": "16 GB DDR5 5200MHz",
            "Ổ cứng": "512 GB PCIe NVMe SSD",
            "Màn hình": "15.6 inch FHD (1920 x 1080) IPS 144Hz",
            "Trọng lượng": "2.10 kg"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/home/laptop-stealth.svg",
        "trang_thai": 1,
    },

    # --- 3. Màn hình (SEED_L003) ---
    {
        "ma_sp": "SP_MSIG271",
        "sku": "MSI-OPTIX-G271",
        "ten_sp": "Màn hình Gaming MSI Optix G271 27 inch IPS 144Hz",
        "ma_loai_sp": "SEED_L003",
        "thuong_hieu": "MSI",
        "gia_ban_hien_tai": 4890000.0,
        "mo_ta": "Tấm nền IPS chuẩn màu sắc nét, góc nhìn rộng 178 độ, tần số quét 144Hz cùng thời gian phản hồi 1ms chống xé hình AMD FreeSync.",
        "thong_so_ky_thuat": json.dumps({
            "Kích thước": "27 inch",
            "Độ phân giải": "Full HD (1920 x 1080)",
            "Tấm nền": "IPS",
            "Tần số quét": "144 Hz",
            "Thời gian phản hồi": "1 ms (MPRT)",
            "Cổng kết nối": "2x HDMI 1.4b, 1x DisplayPort 1.2a, Audio out"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 36,
        "duong_dan_anh": "/images/home/monitor-g271.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_DELLU2724D",
        "sku": "DEL-ULTRASHARP-27",
        "ten_sp": "Màn hình Đồ Họa Dell UltraSharp U2724D 27 inch 2K 120Hz",
        "ma_loai_sp": "SEED_L003",
        "thuong_hieu": "Dell",
        "gia_ban_hien_tai": 11990000.0,
        "mo_ta": "Công nghệ IPS Black đột phá cho tỷ lệ tương phản 2000:1 sâu thẳm, tần số 120Hz mượt mà và cảm biến ánh sáng điều chỉnh độ sáng tự động.",
        "thong_so_ky_thuat": json.dumps({
            "Kích thước": "27 inch",
            "Độ phân giải": "QHD (2560 x 1440)",
            "Tấm nền": "IPS Black chống chói",
            "Độ phủ màu": "100% sRGB, 98% DCI-P3, Delta E < 2",
            "Tần số quét": "120 Hz",
            "Cổng kết nối": "DisplayPort 1.4, HDMI, USB-C upstream/downstream 15W"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 36,
        "duong_dan_anh": "/images/home/monitor-mag272.webp",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_ASUSROG_PG27",
        "sku": "ASU-ROG-PG27AQDM",
        "ten_sp": "Màn hình Gaming ASUS ROG Swift OLED PG27AQDM 240Hz",
        "ma_loai_sp": "SEED_L003",
        "thuong_hieu": "ASUS",
        "gia_ban_hien_tai": 24990000.0,
        "mo_ta": "Tấm nền OLED cao cấp 2K 240Hz với tốc độ phản hồi 0.03ms, tích hợp tản nhiệt tùy chỉnh độc quyền chống lưu ảnh hoàn hảo.",
        "thong_so_ky_thuat": json.dumps({
            "Kích thước": "26.5 inch",
            "Độ phân giải": "QHD (2560 x 1440)",
            "Tấm nền": "OLED chống chói",
            "Tần số quét": "240 Hz",
            "Thời gian phản hồi": "0.03 ms (GTG)",
            "Độ sáng": "1000 nits (Peak HDR)"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 36,
        "duong_dan_anh": "/images/home/monitor-g271.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_SAMSUNGG7",
        "sku": "SAM-ODYSSEY-G7",
        "ten_sp": "Màn hình Cong Samsung Odyssey G7 32 inch 2K 240Hz 1000R",
        "ma_loai_sp": "SEED_L003",
        "thuong_hieu": "Samsung",
        "gia_ban_hien_tai": 13490000.0,
        "mo_ta": "Độ cong lý tưởng 1000R ôm trọn tầm nhìn game thủ, công nghệ chấm lượng tử QLED sống động cùng chứng nhận tương thích G-Sync.",
        "thong_so_ky_thuat": json.dumps({
            "Kích thước": "32 inch cong 1000R",
            "Độ phân giải": "2K WQHD (2560 x 1440)",
            "Tấm nền": "VA QLED",
            "Tần số quét": "240 Hz",
            "Chuẩn HDR": "VESA DisplayHDR 600",
            "Đèn nền": "CoreSync LED RGB phía sau"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 24,
        "duong_dan_anh": "/images/home/monitor-mag272.webp",
        "trang_thai": 1,
    },

    # --- 4. Phụ kiện & Thiết bị ngoại vi (SEED_L004) ---
    {
        "ma_sp": "SP_LOGITECHMXM3S",
        "sku": "LOG-MXM3S-GRAP",
        "ten_sp": "Chuột Không Dây Logitech MX Master 3S Quiet Clicks",
        "ma_loai_sp": "SEED_L004",
        "thuong_hieu": "Logitech",
        "gia_ban_hien_tai": 2290000.0,
        "mo_ta": "Chuột công thái học cao cấp cho lập trình viên và sáng tạo nội dung, mắt đọc 8000 DPI hoạt động trên mọi bề mặt kể cả mặt kính trong suốt.",
        "thong_so_ky_thuat": json.dumps({
            "Cảm biến": "Darkfield độ chính xác cao 8000 DPI",
            "Kết nối": "Bluetooth Low Energy & Logi Bolt USB",
            "Con lăn": "MagSpeed điện từ cuộn 1000 dòng/giây",
            "Thời lượng pin": "Lên đến 70 ngày, sạc nhanh qua cổng USB-C",
            "Trọng lượng": "141 g"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage30.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_RAZERDA_V3PRO",
        "sku": "RAZ-DAV3-PRO-BLK",
        "ten_sp": "Chuột Gaming Razer DeathAdder V3 Pro Wireless Siêu Nhẹ",
        "ma_loai_sp": "SEED_L004",
        "thuong_hieu": "Razer",
        "gia_ban_hien_tai": 3390000.0,
        "mo_ta": "Form dáng công thái học huyền thoại chuẩn Esports với trọng lượng siêu nhẹ 63g, cảm biến quang học Focus Pro 30K DPI cực kỳ chính xác.",
        "thong_so_ky_thuat": json.dumps({
            "Trọng lượng": "63 g siêu nhẹ",
            "Cảm biến": "Razer Focus Pro 30K Optical Sensor",
            "Switch phím": "Optical Mouse Switches Gen-3 (90 triệu lần nhấn)",
            "Kết nối": "Razer HyperSpeed Wireless & Dây Speedflex",
            "Thời lượng pin": "Lên đến 90 giờ chơi game liên tục"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 24,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage31.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_AKKO3098B",
        "sku": "AKK-3098B-PLUS",
        "ten_sp": "Bàn Phím Cơ Không Dây Akko 3098B Plus Multi-Modes",
        "ma_loai_sp": "SEED_L004",
        "thuong_hieu": "Akko",
        "gia_ban_hien_tai": 1790000.0,
        "mo_ta": "Layout 98 phím nhỏ gọn nhưng giữ nguyên bàn phím số, trang bị hotswap 5-pin, lót sẵn foam tiêu âm và bộ keycap PBT double-shot bền đẹp.",
        "thong_so_ky_thuat": json.dumps({
            "Layout": "98 phím (1800 compact)",
            "Switch": "Akko CS V3 Cream Yellow Pro (Linear)",
            "Keycap": "PBT Double-Shot ASA profile",
            "Kết nối": "3 chế độ: Type-C, Bluetooth 5.0, Wireless 2.4GHz",
            "Dung lượng pin": "3000 mAh"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage32.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_SONYWH1000XM5",
        "sku": "SNY-WH1000XM5-BLK",
        "ten_sp": "Tai Nghe Chụp Tai Sony WH-1000XM5 Chống Ồn Cao Cấp",
        "ma_loai_sp": "SEED_L004",
        "thuong_hieu": "Sony",
        "gia_ban_hien_tai": 7990000.0,
        "mo_ta": "Công nghệ chống ồn Auto NC Optimizer hàng đầu thế giới với 2 bộ xử lý và 8 micro, màng loa sợi carbon 30mm cho chất âm Hi-Res Audio xuất sắc.",
        "thong_so_ky_thuat": json.dumps({
            "Driver": "30 mm màng loa composite sợi carbon siêu nhẹ",
            "Chống ồn": "Chip QN1 + V1 tích hợp",
            "Chuẩn âm thanh": "Hi-Res Audio Wireless, LDAC, DSEE Extreme",
            "Thời lượng pin": "30 giờ (bật NC), sạc nhanh 3 phút dùng 3 giờ",
            "Micro thoại": "4 micro beamforming lọc gió AI"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 12,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage34.png",
        "trang_thai": 1,
    },
    {
        "ma_sp": "SP_ANKERPRIME67W",
        "sku": "ANK-A2669-PRIME",
        "ten_sp": "Củ Sạc Nhanh Anker Prime 67W GaN 3 Cổng (2C1A)",
        "ma_loai_sp": "SEED_L004",
        "thuong_hieu": "Anker",
        "gia_ban_hien_tai": 1090000.0,
        "mo_ta": "Công nghệ GaNPrime độc quyền sạc nhanh đa thiết bị, cảm biến nhiệt thông minh ActiveShield 2.0 theo dõi nhiệt độ hơn 3 triệu lần/ngày.",
        "thong_so_ky_thuat": json.dumps({
            "Công suất tối đa": "67W Max",
            "Số cổng": "2 cổng USB-C, 1 cổng USB-A",
            "Công nghệ": "GaNPrime, PowerIQ 4.0, ActiveShield 2.0",
            "Tương thích": "MacBook Air/Pro, iPhone 15/14, iPad, Samsung Galaxy",
            "Thiết kế": "Chân cắm gập 90 độ tiện lợi mang đi"
        }, ensure_ascii=False),
        "don_vi": "Cái",
        "bao_hanh_thang": 18,
        "duong_dan_anh": "/images/figma-mobile/home-imgImage42.png",
        "trang_thai": 1,
    },
]

WAREHOUSES = [-900001, -900002, -900003]
INVENTORY_PER_WAREHOUSE = {
    -900001: 50,  # Kho trung tâm
    -900002: 30,  # Kho chi nhánh A
    -900003: 20,  # Kho chi nhánh B
}


def main():
    print(f"Bắt đầu thêm {len(PRODUCTS)} sản phẩm vào bảng SAN_PHAM...")
    
    # 1. Upsert SAN_PHAM
    res_sp = supabase.table("SAN_PHAM").upsert(PRODUCTS, on_conflict="ma_sp").execute()
    print(f"-> Đã thêm/cập nhật thành công {len(res_sp.data)} sản phẩm vào SAN_PHAM!")

    # 2. Tạo bản ghi TON_KHO
    now_iso = datetime.now(timezone.utc).isoformat()
    inventory_rows = []
    for p in PRODUCTS:
        for kho_id in WAREHOUSES:
            inventory_rows.append({
                "ma_kho": kho_id,
                "sku": p["sku"],
                "so_luong_ton": INVENTORY_PER_WAREHOUSE.get(kho_id, 20),
                "cap_nhat_luc": now_iso,
            })
    
    print(f"Bắt đầu thêm {len(inventory_rows)} bản ghi tồn kho vào bảng TON_KHO...")
    res_tk = supabase.table("TON_KHO").upsert(inventory_rows, on_conflict="ma_kho,sku").execute()
    print(f"-> Đã thêm/cập nhật thành công {len(res_tk.data)} bản ghi vào TON_KHO!")
    print("\nHoàn tất seed dữ liệu thành công!")


if __name__ == "__main__":
    main()

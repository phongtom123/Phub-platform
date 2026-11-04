-- User-authorized catalog/receiving batch. Only newly created SKUs in warehouse 1.
-- The manifest below is embedded from the JSON file after image preparation.
-- Prices are configured sample catalog inputs, not supplier quotations.
-- Receipt/stock/history writes go through the application's existing business RPC.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $catalog_import$
declare
  manifest jsonb := $catalog_manifest${
  "batch": "catalog-warehouse1-20261103",
  "warehouse_id": 1,
  "actor_email": "admin123@gmail.com",
  "markup_rate": "25",
  "taxes": [
    {
      "code": "VAT",
      "name": "VAT",
      "rate": "10"
    }
  ],
  "price_note": "Giá nhập cấu hình cho đợt bổ sung dữ liệu theo yêu cầu; không phải báo giá hoặc hợp đồng mua hàng thực tế.",
  "categories": [
    {
      "id": "COMPONENT_CASE",
      "name": "Vỏ máy tính",
      "parent": "L_LINHKIEN"
    },
    {
      "id": "COMPONENT_COOLING_AIR",
      "name": "Tản nhiệt khí",
      "parent": "L_LINHKIEN"
    },
    {
      "id": "COMPONENT_COOLING_LIQUID",
      "name": "Tản nhiệt nước AIO",
      "parent": "L_LINHKIEN"
    },
    {
      "id": "COMPONENT_FAN",
      "name": "Quạt tản nhiệt case",
      "parent": "L_LINHKIEN"
    },
    {
      "id": "COMPONENT_HDD",
      "name": "Ổ cứng HDD",
      "parent": "L_LINHKIEN"
    },
    {
      "id": "ACCESSORY_WEBCAM",
      "name": "Webcam",
      "parent": "SEED_L004"
    },
    {
      "id": "ACCESSORY_SPEAKER",
      "name": "Loa máy tính",
      "parent": "SEED_L004"
    },
    {
      "id": "ACCESSORY_USB_HUB",
      "name": "Hub USB",
      "parent": "SEED_L004"
    }
  ],
  "receipts": [
    {
      "group": "components",
      "supplier_name": "[SEED] Nhà cung cấp 1",
      "note": "Bổ sung catalog 03/11/2026: vỏ máy và tản nhiệt, nhập riêng kho 1.",
      "create_key": "b814496b-632f-421d-92c7-1098861a7068",
      "confirm_key": "a6011a5a-e544-40cc-b7d7-feafe7c4786b"
    },
    {
      "group": "storage",
      "supplier_name": "[SEED] Nhà cung cấp 2",
      "note": "Bổ sung catalog 03/11/2026: ổ cứng HDD, nhập riêng kho 1.",
      "create_key": "3e2476c7-6f71-44f5-9ba5-d164726e9c94",
      "confirm_key": "90ebdfa5-7731-41f1-90a5-91121ccc2bd1"
    },
    {
      "group": "accessories",
      "supplier_name": "[SEED] Nhà cung cấp 3",
      "note": "Bổ sung catalog 03/11/2026: webcam, loa, hub USB, nhập riêng kho 1.",
      "create_key": "1fa14a76-217e-47ac-9f3b-a21aecc9bbcd",
      "confirm_key": "8645eea5-8f01-42d7-82ee-ef5437170d5e"
    }
  ],
  "products": [
    {
      "sku": "COR-CASE-3000D-AIRFLOW-BLK",
      "name": "Vỏ máy Corsair 3000D Airflow màu đen",
      "category": "COMPONENT_CASE",
      "brand": "Corsair",
      "quantity": 10,
      "unit_cost": "1000000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "components",
      "specs": "Loại case: Mid-Tower\nMàu sắc: Đen\nMặt hông: Kính cường lực\nMã hãng: CC-9011251-WW",
      "source": "https://www.corsair.com/ww/en/p/pc-cases/CC-9011251-WW/3000d-tempered-glass-mid-tower-black-cc-9011251-ww",
      "image_source": "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Cases/CC-9011251-WW/3000D_AF_BLACK_RENDER_01.webp",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/84a8a0407407446496469115f29658e5.webp",
      "sale_price_before_vat": "1250000"
    },
    {
      "sku": "COR-CASE-2000D-AIRFLOW-BLK",
      "name": "Vỏ máy Corsair 2000D Airflow Mini-ITX màu đen",
      "category": "COMPONENT_CASE",
      "brand": "Corsair",
      "quantity": 15,
      "unit_cost": "1300000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "components",
      "specs": "Loại case: Small Form Factor\nChuẩn bo mạch chủ: Mini-ITX\nMàu sắc: Đen\nMã hãng: CC-9011244-WW",
      "source": "https://www.corsair.com/us/en/p/pc-cases/cc-9011244-ww/2000d-airflow-mini-itx-pc-case-black-cc-9011244-ww",
      "image_source": "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Cases/base-2000D-rgb-airflow/CC-9011244/CC-9011244_01.webp",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/a26ab004908b47afae014130743182e0.webp",
      "sale_price_before_vat": "1625000"
    },
    {
      "sku": "CM-CASE-MASTERBOX-Q300L",
      "name": "Vỏ máy Cooler Master MasterBox Q300L",
      "category": "COMPONENT_CASE",
      "brand": "Cooler Master",
      "quantity": 20,
      "unit_cost": "900000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại case: Mini Tower\nChuẩn bo mạch chủ: Micro-ATX, Mini-ITX\nMàu sắc: Đen",
      "source": "https://www.coolermaster.com/en-us/products/masterbox-q300l.html",
      "image_source": "https://www.coolermaster.com/on/demandware.static/-/Sites-cooler-master-main/default/dwf7ababb2/Assets/masterbox-q300l/large/gallery-1-min.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/e3aff4e3112a4f39886a157ec9b7fc3f.webp",
      "sale_price_before_vat": "1125000"
    },
    {
      "sku": "TR-AIR-AX120-REFINED-SE",
      "name": "Tản nhiệt khí Thermalright Assassin X 120 Refined SE",
      "category": "COMPONENT_COOLING_AIR",
      "brand": "Thermalright",
      "quantity": 25,
      "unit_cost": "350000",
      "unit": "Bộ",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại tản nhiệt: Tản nhiệt khí\nKích thước quạt: 120mm\nDòng sản phẩm: Assassin X 120 Refined SE",
      "source": "https://www.thermalright.com/product/assassin-x-120-refined-se/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/assassin-x-120-refined-se.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/ade33a867b864c78899fa4c8b7420ade.webp",
      "sale_price_before_vat": "437500"
    },
    {
      "sku": "TR-AIR-ASSASSIN-KING120-SE",
      "name": "Tản nhiệt khí Thermalright Assassin King 120 SE",
      "category": "COMPONENT_COOLING_AIR",
      "brand": "Thermalright",
      "quantity": 30,
      "unit_cost": "400000",
      "unit": "Bộ",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại tản nhiệt: Tản nhiệt khí\nỐng dẫn nhiệt: 5 ống 6mm\nChiều cao: 148mm\nKích thước quạt: 120mm",
      "source": "https://www.thermalright.com/product/assassin-king-120-se/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/assassin-king-120-se.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/c4a9be1844c045979673d952e241af2a.webp",
      "sale_price_before_vat": "500000"
    },
    {
      "sku": "TR-AIR-BURST-ASSASSIN120",
      "name": "Tản nhiệt khí Thermalright Burst Assassin 120",
      "category": "COMPONENT_COOLING_AIR",
      "brand": "Thermalright",
      "quantity": 35,
      "unit_cost": "500000",
      "unit": "Bộ",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại tản nhiệt: Tản nhiệt khí\nỐng dẫn nhiệt: 6 ống\nKích thước quạt: 120mm",
      "source": "https://www.thermalright.com/product/burst-assassin-120/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/burst-assassin-120.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/4d6ff489a2ba485db70cbcaf04bed8c9.webp",
      "sale_price_before_vat": "625000"
    },
    {
      "sku": "TR-AIO-FROZEN-NOTTE240-BLK",
      "name": "Tản nhiệt nước Thermalright Frozen Notte 240 Black ARGB",
      "category": "COMPONENT_COOLING_LIQUID",
      "brand": "Thermalright",
      "quantity": 40,
      "unit_cost": "1000000",
      "unit": "Bộ",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại tản nhiệt: AIO\nKích thước radiator: 240mm\nĐèn LED: ARGB\nMàu sắc: Đen",
      "source": "https://www.thermalright.com/product/frozen-notte-240-black-argb/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/frozen-notte-240-black-argb.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/233cefe298214460a46f15d304266562.webp",
      "sale_price_before_vat": "1250000"
    },
    {
      "sku": "TR-AIO-FROZEN-NOTTE360-BLK",
      "name": "Tản nhiệt nước Thermalright Frozen Notte 360 Black ARGB",
      "category": "COMPONENT_COOLING_LIQUID",
      "brand": "Thermalright",
      "quantity": 45,
      "unit_cost": "1300000",
      "unit": "Bộ",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại tản nhiệt: AIO\nKích thước radiator: 360mm\nĐèn LED: ARGB\nMàu sắc: Đen",
      "source": "https://www.thermalright.com/product/frozen-notte-360-black-argb/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/frozen-notte-360-black-argb.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/b475b7fdc5ef4df99a7ad99bfde02b74.webp",
      "sale_price_before_vat": "1625000"
    },
    {
      "sku": "TR-AIO-FROZEN-PRISM240-BLK",
      "name": "Tản nhiệt nước Thermalright Frozen Prism 240 Black ARGB",
      "category": "COMPONENT_COOLING_LIQUID",
      "brand": "Thermalright",
      "quantity": 50,
      "unit_cost": "850000",
      "unit": "Bộ",
      "warranty_months": 0,
      "group": "components",
      "specs": "Loại tản nhiệt: AIO\nKích thước radiator: 240mm\nĐèn LED: ARGB\nMàu sắc: Đen",
      "source": "https://www.thermalright.com/product/frozen-prism-240-black-argb/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/frozen-prism-240-black-argb.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/8fb131349a4f47e3a3e946c8432b0b15.webp",
      "sale_price_before_vat": "1062500"
    },
    {
      "sku": "TR-FAN-TL-C12C-120",
      "name": "Quạt case Thermalright TL-C12C 120mm PWM",
      "category": "COMPONENT_FAN",
      "brand": "Thermalright",
      "quantity": 10,
      "unit_cost": "90000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "components",
      "specs": "Kích thước quạt: 120mm\nKết nối: PWM 4-pin\nĐèn LED: Không",
      "source": "https://www.thermalright.com/product/tl-c12c/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/tl-c12c.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/c99657f1cb28452cb0dcfd93d1abddcc.webp",
      "sale_price_before_vat": "112500"
    },
    {
      "sku": "TR-FAN-TL-C12C-S-ARGB",
      "name": "Quạt case Thermalright TL-C12C-S 120mm ARGB",
      "category": "COMPONENT_FAN",
      "brand": "Thermalright",
      "quantity": 15,
      "unit_cost": "120000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "components",
      "specs": "Kích thước quạt: 120mm\nKết nối: PWM 4-pin\nĐèn LED: ARGB",
      "source": "https://www.thermalright.com/product/tl-c12c-s/",
      "image_source": "https://www.thermalright.com/wp-content/uploads/2026/08/tl-c12c-s-1.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/a7f98c63290e4bdc972dc2dd8225ae2b.webp",
      "sale_price_before_vat": "150000"
    },
    {
      "sku": "ARC-FAN-P12-PWM-PST-BLK",
      "name": "Quạt case ARCTIC P12 PWM PST 120mm màu đen",
      "category": "COMPONENT_FAN",
      "brand": "ARCTIC",
      "quantity": 20,
      "unit_cost": "150000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "components",
      "specs": "Kích thước quạt: 120mm\nĐiều khiển: PWM\nĐồng bộ quạt: PST\nMàu sắc: Đen",
      "source": "https://www.arctic.de/en/P12-PWM-PST/ACFAN00120A",
      "image_source": "https://www.arctic.de/media/51/49/e8/1583760048/P12_PWM_PST_Black_01.jpg",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/acb344fdecbb4dc29787e075f15017c6.webp",
      "sale_price_before_vat": "187500"
    },
    {
      "sku": "WD-HDD-BLUE-1TB-WD10EZEX",
      "name": "Ổ cứng HDD WD Blue 1TB WD10EZEX SATA 3.5 inch",
      "category": "COMPONENT_HDD",
      "brand": "Western Digital",
      "quantity": 25,
      "unit_cost": "850000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "storage",
      "specs": "Dung lượng HDD: 1TB\nKích thước: 3.5 inch\nGiao tiếp: SATA\nMã hãng: WD10EZEX",
      "source": "https://www.westerndigital.com/en-gb/products/internal-drives/wd-blue-desktop-sata-hdd?sku=WD10EZEX",
      "image_source": "https://www.westerndigital.com/content/dam/store/en-us/assets/products/internal-storage/wd-blue-desktop-sata-hdd/gallery/wd-blue-pc-desktop-hard-drive-1tb.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/ccbb4de3eef143d291cff5792cf82313.webp",
      "sale_price_before_vat": "1062500"
    },
    {
      "sku": "WD-HDD-BLUE-2TB-WD20EZBX",
      "name": "Ổ cứng HDD WD Blue 2TB WD20EZBX SATA 3.5 inch",
      "category": "COMPONENT_HDD",
      "brand": "Western Digital",
      "quantity": 30,
      "unit_cost": "1250000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "storage",
      "specs": "Dung lượng HDD: 2TB\nKích thước: 3.5 inch\nGiao tiếp: SATA\nMã hãng: WD20EZBX",
      "source": "https://www.westerndigital.com/en-gb/products/internal-drives/wd-blue-desktop-sata-hdd?sku=WD20EZBX",
      "image_source": "https://www.westerndigital.com/content/dam/store/en-us/assets/products/internal-storage/wd-blue-desktop-sata-hdd/gallery/wd-blue-pc-desktop-hard-drive-2tb.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/7078fdbbd670421aba610689f87fd223.webp",
      "sale_price_before_vat": "1562500"
    },
    {
      "sku": "TOS-HDD-P300-2TB-HDWD120",
      "name": "Ổ cứng HDD Toshiba P300 2TB HDWD120",
      "category": "COMPONENT_HDD",
      "brand": "Toshiba",
      "quantity": 35,
      "unit_cost": "1200000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "storage",
      "specs": "Dung lượng HDD: 2TB\nKích thước: 3.5 inch\nGiao tiếp: SATA\nMã hãng: HDWD120",
      "source": "https://www.toshiba-storage.com/products/toshiba-internal-hard-drives-p300/",
      "image_source": "https://www.toshiba-storage.com/wp/wp-content/uploads/2019/09/toshiba-internal-hard-drive-P300.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/8c9374c7c1234002b8650d3dd5900b0a.webp",
      "sale_price_before_vat": "1500000"
    },
    {
      "sku": "LOG-WEBCAM-C270-HD",
      "name": "Webcam Logitech C270 HD 720p",
      "category": "ACCESSORY_WEBCAM",
      "brand": "Logitech",
      "quantity": 40,
      "unit_cost": "450000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "accessories",
      "specs": "Độ phân giải: HD 720p\nKết nối: USB\nMicrophone: Tích hợp",
      "source": "https://www.logitech.com/en-us/products/webcams/c270-hd-webcam.960-000694.html",
      "image_source": "https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/products/logitech/webcams/c270-hd-webcam/gallery/c270-hd-webcam-1-0224.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/7ef8c29f562c411db7ceb29b4d8bbf9e.webp",
      "sale_price_before_vat": "562500"
    },
    {
      "sku": "LOG-WEBCAM-C920S-PRO-HD",
      "name": "Webcam Logitech C920s Pro Full HD 1080p",
      "category": "ACCESSORY_WEBCAM",
      "brand": "Logitech",
      "quantity": 45,
      "unit_cost": "1200000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "accessories",
      "specs": "Độ phân giải: Full HD 1080p\nKết nối: USB\nMicrophone: Stereo tích hợp\nNắp che riêng tư: Có",
      "source": "https://www.logitech.com/en-us/products/webcams/c920-pro-hd-webcam.960-000764.html",
      "image_source": "https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/c920s/gallery/c920s-gallery-1.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/dcca26bef6ed4aeb88e397b74140926b.webp",
      "sale_price_before_vat": "1500000"
    },
    {
      "sku": "LOG-WEBCAM-BRIO100-GRAPHITE",
      "name": "Webcam Logitech Brio 100 Full HD 1080p màu graphite",
      "category": "ACCESSORY_WEBCAM",
      "brand": "Logitech",
      "quantity": 50,
      "unit_cost": "650000",
      "unit": "Cái",
      "warranty_months": 24,
      "group": "accessories",
      "specs": "Độ phân giải: Full HD 1080p\nKết nối: USB\nMàu sắc: Graphite\nNắp che riêng tư: Có",
      "source": "https://www.logitech.com/en-us/products/webcams/brio-100-webcam.960-001580.html",
      "image_source": "https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-100/gallery/brio-100-gallery-graphite-1.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/f4c1d1f1590f4e46b96ab2f654d61aa8.webp",
      "sale_price_before_vat": "812500"
    },
    {
      "sku": "LOG-SPEAKER-S150-USB",
      "name": "Loa máy tính Logitech S150 USB Stereo",
      "category": "ACCESSORY_SPEAKER",
      "brand": "Logitech",
      "quantity": 10,
      "unit_cost": "300000",
      "unit": "Bộ",
      "warranty_months": 24,
      "group": "accessories",
      "specs": "Hệ thống loa: 2.0\nNguồn điện: USB\nĐầu vào âm thanh: USB",
      "source": "https://www.logi.com/en-us/shop/p/s150-usb-stereo-speakers.980-000028",
      "image_source": "https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/speakers/computer-speakers/s150/gallery/s150-gallery-01.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/8d3c8050751e4dd6a256e7cfd2d6ff11.webp",
      "sale_price_before_vat": "375000"
    },
    {
      "sku": "LOG-SPEAKER-Z150-BLK",
      "name": "Loa máy tính Logitech Z150 Stereo màu đen",
      "category": "ACCESSORY_SPEAKER",
      "brand": "Logitech",
      "quantity": 15,
      "unit_cost": "500000",
      "unit": "Bộ",
      "warranty_months": 24,
      "group": "accessories",
      "specs": "Hệ thống loa: 2.0\nĐầu vào âm thanh: Jack 3.5mm\nMàu sắc: Đen",
      "source": "https://www.logi.com/en-us/shop/p/z150-compact-stereo-speakers.980-000802",
      "image_source": "https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/speakers/computer-speakers/z150/gallery/z150-gallery-1.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/5467a1132d6944be8cda0411f7200b8c.webp",
      "sale_price_before_vat": "625000"
    },
    {
      "sku": "LOG-SPEAKER-Z313-2POINT1",
      "name": "Loa máy tính Logitech Z313 2.1 kèm loa siêu trầm",
      "category": "ACCESSORY_SPEAKER",
      "brand": "Logitech",
      "quantity": 20,
      "unit_cost": "950000",
      "unit": "Bộ",
      "warranty_months": 24,
      "group": "accessories",
      "specs": "Hệ thống loa: 2.1\nLoa siêu trầm: Có\nĐầu vào âm thanh: Jack 3.5mm",
      "source": "https://www.logitech.com/en-us/products/speakers/z313-speaker-system-subwoofer.980-000382.html",
      "image_source": "https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/speakers/computer-speakers/z313/gallery/z313-gallery-1.png",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/826f1f18824a4b05b2e765e581b4cd36.webp",
      "sale_price_before_vat": "1187500"
    },
    {
      "sku": "TPL-HUB-UH400-4PORT",
      "name": "Hub USB TP-Link UH400 4 cổng USB 3.0",
      "category": "ACCESSORY_USB_HUB",
      "brand": "TP-Link",
      "quantity": 25,
      "unit_cost": "200000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "accessories",
      "specs": "Số cổng USB: 4\nChuẩn USB: USB 3.0\nKiểu thiết bị: Hub USB",
      "source": "https://www.tp-link.com/us/home-networking/usb-hub/uh400/",
      "image_source": "https://static.tp-link.com/UH400(UN)2.0-PT3%EF%BC%8D960x720_1479037345917k.jpg",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/f8502b8a6ef34cd7b76ce06d891977fa.webp",
      "sale_price_before_vat": "250000"
    },
    {
      "sku": "TPL-HUB-UH700-7PORT",
      "name": "Hub USB TP-Link UH700 7 cổng USB 3.0",
      "category": "ACCESSORY_USB_HUB",
      "brand": "TP-Link",
      "quantity": 30,
      "unit_cost": "650000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "accessories",
      "specs": "Số cổng USB: 7\nChuẩn USB: USB 3.0\nKiểu thiết bị: Hub USB có nguồn",
      "source": "https://www.tp-link.com/us/home-networking/usb-hub/uh700/",
      "image_source": "https://static.tp-link.com/UH700_UN_2.0_01_large_1537408325767z.jpg",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/a8614587e6d94840a13c07ae77975a3d.webp",
      "sale_price_before_vat": "812500"
    },
    {
      "sku": "TPL-HUB-UH720-7PORT",
      "name": "Hub USB TP-Link UH720 7 cổng dữ liệu và 2 cổng sạc",
      "category": "ACCESSORY_USB_HUB",
      "brand": "TP-Link",
      "quantity": 35,
      "unit_cost": "800000",
      "unit": "Cái",
      "warranty_months": 0,
      "group": "accessories",
      "specs": "Số cổng dữ liệu: 7\nCổng sạc riêng: 2\nChuẩn USB: USB 3.0\nKiểu thiết bị: Hub USB có nguồn",
      "source": "https://www.tp-link.com/us/home-networking/usb-hub/uh720/",
      "image_source": "https://static.tp-link.com/upload/image-line/UH720_UN_5.0_overview_01_large_20250304062027t.jpg",
      "image_url": "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/815fa1af857548349065a58a1b8faca7.webp",
      "sale_price_before_vat": "1000000"
    }
  ]
}$catalog_manifest$::jsonb;
  actor_id text;
  sku_list text[];
  confirm_keys uuid[];
  receipt_ids int[] := '{}';
  installed int;
  completed int;
  product_number bigint;
  item jsonb;
  category jsonb;
  receipt jsonb;
  supplier_id int;
  receipt_id int;
  response jsonb;
  lines jsonb;
  quote jsonb;
  prior_inventory text;
  prior_products text;
  prior_receipts text;
  prior_receipt_lines text;
  current_digest text;
begin
  if (manifest->>'warehouse_id')::int <> 1 or jsonb_array_length(manifest->'products') <> 24
  then raise exception 'Unexpected warehouse or batch size'; end if;
  if exists (select 1 from jsonb_array_elements(manifest->'products') p
      where (p->>'quantity')::int not between 10 and 50 or (p->>'unit_cost')::numeric <= 0
        or not (p->>'image_url' like 'https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/%'))
  then raise exception 'Invalid quantity, cost or unprepared image'; end if;

  select array_agg(p->>'sku') into sku_list from jsonb_array_elements(manifest->'products') p;
  if (select count(distinct x) from unnest(sku_list) x) <> 24
  then raise exception 'Duplicate SKU in manifest'; end if;
  select array_agg((r->>'confirm_key')::uuid) into confirm_keys from jsonb_array_elements(manifest->'receipts') r;

  select t.ma_tk into strict actor_id from public."TAI_KHOAN" t
    join public."NHAN_VIEN" n using (ma_nhan_vien)
    where t.email=manifest->>'actor_email' and t.trang_thai=1 and n.trang_thai=1 and n.loai_nhan_vien='ADMIN';
  -- Validate the actor using the same permission function as production commands.
  perform admin_ops.actor(actor_id);
  perform 1 from public."KHO" where ma_kho=1 and trang_thai=1 for share;
  if not found then raise exception 'Warehouse 1 is not active'; end if;

  -- Same lock order as receipt commands: products before inventory updates.
  lock table public."SAN_PHAM" in share row exclusive mode;
  select count(*) into installed from public."SAN_PHAM" where sku=any(sku_list);
  select count(*) into completed from admin_ops.requests where actor=actor_id
    and key=any(confirm_keys) and resource='priced-receipts' and action='confirm' and result is not null;
  if installed=24 and completed=3 then
    raise notice 'Batch already applied; no products, receipts or inventory changed';
    return;
  end if;
  if installed<>0 or completed<>0 then
    raise exception 'SKU collision or incomplete batch; refusing to overwrite existing data';
  end if;

  select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by ma_kho,sku),'')) into prior_inventory from public."TON_KHO" t;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by ma_sp),'')) into prior_products from public."SAN_PHAM" p;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by ma_phieu_nhap),'')) into prior_receipts from public."PHIEU_NHAP" p;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by ma_phieu_nhap,sku),'')) into prior_receipt_lines from public."CT_PHIEU_NHAP" p;

  for category in select value from jsonb_array_elements(manifest->'categories') loop
    perform 1 from public."LOAI_SP" where ma_loai_sp=category->>'parent' and trang_thai=1;
    if not found then raise exception 'Inactive or missing parent category'; end if;
    insert into public."LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp,trang_thai)
      values(category->>'id',category->>'name',category->>'parent',1)
      on conflict(ma_loai_sp_con) do nothing;
    perform 1 from public."LOAI_SP_CON" where ma_loai_sp_con=category->>'id'
      and ma_loai_sp=category->>'parent' and trang_thai=1;
    if not found then raise exception 'Subcategory conflicts with the import'; end if;
  end loop;

  select coalesce(max(substring(ma_sp from '^SP([0-9]+)$')::bigint),0)
    into product_number from public."SAN_PHAM" where ma_sp ~ '^SP[0-9]+$';
  for item in select value from jsonb_array_elements(manifest->'products') loop
    product_number := product_number+1;
    select value into strict category from jsonb_array_elements(manifest->'categories') where value->>'id'=item->>'category';
    insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,thuong_hieu,
      gia_ban_hien_tai,mo_ta,thong_so_ky_thuat,don_vi,bao_hanh_thang,duong_dan_anh,trang_thai)
    values('SP'||lpad(product_number::text,greatest(3,length(product_number::text)),'0'),
      item->>'sku',item->>'name',category->>'parent',item->>'category',item->>'brand',
      round((item->>'unit_cost')::numeric*(1+(manifest->>'markup_rate')::numeric/100)),
      replace(item->>'specs',E'\n','; '),item->>'specs',item->>'unit',(item->>'warranty_months')::int,item->>'image_url',1);
  end loop;

  for receipt in select value from jsonb_array_elements(manifest->'receipts') loop
    select ma_ncc into strict supplier_id from public."NHA_CUNG_CAP"
      where ten_ncc=receipt->>'supplier_name' and trang_thai=1;
    select jsonb_agg(jsonb_build_object('sku',p->>'sku','quantity',(p->>'quantity')::int,
      'unit_price',p->>'unit_cost','markup_rate',manifest->>'markup_rate','taxes',manifest->'taxes') order by p->>'sku')
      into lines from jsonb_array_elements(manifest->'products') p where p->>'group'=receipt->>'group';
    if lines is null then raise exception 'Receipt group has no products'; end if;

    response := public.priced_receipt_v1(actor_id,'ADMIN','create',(receipt->>'create_key')::uuid,null,
      jsonb_build_object('warehouse_id',1,'supplier_id',supplier_id,'note',receipt->>'note','lines',lines));
    receipt_id := (response->'data'->0->>'ma_phieu_nhap')::int;
    if receipt_id is null then raise exception 'Receipt creation returned no ID'; end if;
    receipt_ids := array_append(receipt_ids,receipt_id);
    quote := public.receipt_pricing_preview_v1(actor_id,receipt_id);
    response := public.priced_receipt_v1(actor_id,'ADMIN','confirm',(receipt->>'confirm_key')::uuid,receipt_id,
      jsonb_build_object('pricing_version',quote->>'version'));
    if response->'data'->0->>'trang_thai' is distinct from 'DA_NHAP'
    then raise exception 'Receipt was not confirmed'; end if;
  end loop;

  if array_length(receipt_ids,1)<>3 or
    (select count(*) from public."PHIEU_NHAP" where ma_phieu_nhap=any(receipt_ids)
      and ma_kho=1 and trang_thai='DA_NHAP' and dinh_gia_da_ap_dung)<>3
  then raise exception 'Invalid receipt status, warehouse or applied pricing'; end if;

  -- Exact, per-SKU reconciliation of confirmed receiving, cost and stock.
  for item in select value from jsonb_array_elements(manifest->'products') loop
    if (select count(*) from public."TON_KHO" where sku=item->>'sku')<>1 or
      (select so_luong_ton from public."TON_KHO" where ma_kho=1 and sku=item->>'sku') is distinct from (item->>'quantity')::int or
      (select count(*) from public."CT_PHIEU_NHAP" where ma_phieu_nhap=any(receipt_ids) and sku=item->>'sku'
        and so_luong_nhap=(item->>'quantity')::int and gia_nhap=(item->>'unit_cost')::numeric)<>1 or
      (select count(*) from admin_ops.stock_events where warehouse_id=1 and sku=item->>'sku'
        and before_quantity=0 and after_quantity=(item->>'quantity')::int and reference=any(array(select x::text from unnest(receipt_ids) x)))<>1
    then raise exception 'Receipt / stock / history mismatch for SKU %',item->>'sku'; end if;
  end loop;

  select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by ma_kho,sku),'')) into current_digest
    from public."TON_KHO" t where not (ma_kho=1 and sku=any(sku_list));
  if current_digest<>prior_inventory then raise exception 'Existing inventory or another warehouse was changed'; end if;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by ma_sp),'')) into current_digest
    from public."SAN_PHAM" p where not (sku=any(sku_list));
  if current_digest<>prior_products then raise exception 'An existing product was changed'; end if;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by ma_phieu_nhap),'')) into current_digest
    from public."PHIEU_NHAP" p where not (ma_phieu_nhap=any(receipt_ids));
  if current_digest<>prior_receipts then raise exception 'An existing receipt was changed'; end if;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by ma_phieu_nhap,sku),'')) into current_digest
    from public."CT_PHIEU_NHAP" p where not (ma_phieu_nhap=any(receipt_ids));
  if current_digest<>prior_receipt_lines then raise exception 'An existing receipt line was changed'; end if;
end;
$catalog_import$;
commit;

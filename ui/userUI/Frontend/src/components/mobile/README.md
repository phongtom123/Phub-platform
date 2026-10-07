# Mobile UI

## Responsive hiện tại

Catalog và chi tiết hiện chọn layout desktop/mobile ở mốc 760px qua
`CatalogExperience` và `ResponsiveProductDetail`. `HomePage2` và `ProductPage1`
đã được gắn vào route thật và dùng API chung với desktop. Bộ lọc mobile lấy loại
và thương hiệu từ metadata; điều kiện lưu trong URL, mobile dùng 12 sản phẩm/trang.
`AltHeader` và `HomePage1` vẫn dùng CSS responsive; menu ba gạch giữ
`MobileCategoryDrawer`. Xem [CATALOG-INTEGRATION.md](../../../CATALOG-INTEGRATION.md).

Các bản Figma riêng `MobileHeader`, `Account1`,
`CartPage1` và `ContactPage1` được giữ để tham khảo,
không được gắn vào các route hiện tại. `home-page-1/CustomerTestimonials`
và `shared/ServiceBenefits` vẫn được dùng trên trang chủ.

Phần bên dưới ghi lại cấu trúc bản Figma cũ.

Các component **chỉ dùng cho mobile** nằm trong thư mục này:

```text
mobile/
├── header/        MobileHeader và CSS của thanh đầu trang
├── account/       Account 1: menu tài khoản khi nhấn avatar
├── menu/          Menu 1, Menu 2, drawer và dữ liệu danh mục
├── filter/        Filter 1, Filter 2: panel bộ lọc của Home Page 2
├── home-page-1/   Đánh giá khách hàng của Home Page 1
├── home-page-2/   Trang danh mục mobile, dữ liệu mẫu, mô tả và CSS riêng
├── product-page-1/ Trang chi tiết sản phẩm mobile, các section và nội dung mẫu
└── shared/        Lợi ích mua sắm được dùng trên cả hai trang mobile
```

`HomePage1` ở `components/home/` và `AltHeader`/`Footer` ở `components/layout/` vì các component đó phục vụ cả desktop lẫn mobile. Các phần dùng chung vẫn ở `components/common/` và `components/catalog/`; mobile import lại, không sao chép logic hoặc dữ liệu.

Các route App Router nằm trong `src/app/`: `/` dùng `HomePage1`,
`/main/product` dùng `CatalogPage`, `/main/product/[id]` dùng
`DesktopProductDetail` với CSS responsive. Không ghép hai cây desktop/mobile.

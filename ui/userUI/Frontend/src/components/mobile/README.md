# Mobile UI

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

Các route App Router vẫn nằm trong `src/app/`: `/` ghép `HomePage1`, `/main/product` ghép catalog desktop và `mobile/home-page-2/HomePage2`, còn `/main/product/[id]` ghép chi tiết desktop với `mobile/product-page-1/ProductPage1` theo breakpoint 760px.

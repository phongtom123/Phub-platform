# Tech Store common components

Các thành phần nhỏ dùng lại giữa Home, Catalog, Product, Login, Cart và Checkout.
Theo cấu trúc hiện tại: Next.js App Router + TypeScript + CSS Modules; header/footer vẫn thuộc `components/layout`.

## Import và xem thử

```tsx
import { ProductCard, TextField, Button } from "@/components/common";
```

Chạy `npm run dev`, mở `/components-preview` để thử props, trạng thái và thao tác.
Trang này dùng dữ liệu mẫu, không gọi API đăng nhập, đặt hàng hoặc thanh toán.
Các trang nghiệp vụ đang trống không bị thay bằng trang mẫu.

## Đối chiếu Figma

File: [Tech Store](https://www.figma.com/design/74LIkwYtOLwg4vV1xO1JIT/Tech-Store--Community-?node-id=0-1).

| Component | Nguồn thiết kế / nơi dùng | Props chính |
| --- | --- | --- |
| `ProductCard` | Product Card `121:16844`; Home/Catalog | `name`, `href`, `imageSrc`, `amount`, `rating`, `reviewCount`, `stock`, `actions` |
| `Price` | Giá trong Product Card; Cart | `amount`, `originalAmount`, `currency`, `locale` |
| `Rating` | Rating trong Product Card | `value` (0–5, hỗ trợ lẻ), `reviewCount` |
| `StockStatus` | Placeholder `121:2352`, `121:2361` | `status`, `label` |
| `Breadcrumb` | Login `133:3347`, Catalog `73:291` | `items: { label, href? }[]` |
| `TextField` | Email/password của Login; địa chỉ Checkout; newsletter Footer | Native input props, `label`, `hint`, `error`, `variant`, `hideLabel` |
| `SelectField` | Checkout State/Province `133:5256` | Native select props, `label`, `options`, `error` |
| `SearchInput` | Header: ô tìm kiếm responsive | `onSearch`, `placeholder`, `label`, `autoFocus`, `className` |
| `Radio` | Checkout shipping `133:5281` | Native radio props, `label` |
| `QuantityInput` | Product toolbar `126:2674`; Cart | `value`/`defaultValue`, `min`, `max`, `onValueChange` |
| `ColorSwatch` | Catalog color `121:49704` | `color`, `label`, native radio props |
| `Accordion` | Catalog category `121:49690`; Cart summary | `title`, `children`, native details props |
| `FilterOption` | Category/price trong Catalog `121:49690` | `label`, `count`, `selected`, native button props |
| `TabNav` | Product toolbar `126:2674` | `items: {label, href}[]`, `activeHref` |
| `SpecsTable` | Product Specs `126:2561` / `126:2922` | `rows: {label, value}[]`, `caption` |
| `SummaryRow` | Shopping Cart `133:4139` | `label`, `value`, `description`, `total` |
| `Button`, `TextButton` | Component có sẵn; mở rộng theo Login/Cart | `variant`, `size`, native button props |
| `Checkbox`, `IconButton`, `Chevron`, `Pagination`, `BrandTile` | Component có sẵn | Xem interface trong từng file |

`ProductCard` ghép từ `Price`, `Rating`, `StockStatus`. Các vùng khác có thể dùng riêng từng phần.
`ProductCard.actions` nhận nội dung do trang cha cung cấp (ví dụ `Button` thêm giỏ hàng), không gắn sẵn nghiệp vụ.
`SummaryRow` nằm trong `<dl>`; giá trị do trang cha tính, không tự áp thuế/phí.

## Server và Client Components

- `Pagination`, `QuantityInput`, `TextField`, `SelectField` khai báo `"use client"` vì có xử lý sự kiện hoặc tạo ID bằng hook.
- Component còn lại dùng được trong Server Components; khi truyền callback (`onClick`, `onChange`), tạo callback và render component từ một Client Component.
- `QuantityInput` hỗ trợ controlled (`value` + `onValueChange`) và uncontrolled (`defaultValue`). Giá trị giới hạn trong `min`/`max`, chuẩn hóa khi rời ô nhập.
- Các `Radio` / `ColorSwatch` cùng nhóm phải có chung `name`, khác `value`. Bọc bằng `fieldset` và `legend` để đặt tên nhóm.
- `Accordion` dùng `<details>/<summary>` nên mở/đóng bằng chuột hoặc bàn phím không cần JavaScript riêng.
- `TabNav` là điều hướng bằng link đến route/anchor, không phải tab panel ẩn/hiện.
- Truyền dữ liệu và nhãn đã dịch từ trang cha nếu cần ngôn ngữ khác.
- `TextField variant="dark"` dùng trên nền tối; `hideLabel` chỉ ẩn nhãn trực quan, vẫn giữ nhãn cho trình đọc màn hình. `NewsletterForm` thuộc `components/layout` vì chỉ phục vụ footer.

## Style và asset

- Các component có sẵn tiếp tục dùng `common.module.css`; phần mới dùng `store.module.css`.
- Màu thiết kế: primary `#0156ff`, surface `#f5f7ff`, border `#cacdd8`, muted `#a2a6b0`, error `#c94d3f`.
- Root layout cung cấp `--font-poppins` qua `next/font`; các component common chọn font này mà không đổi font mặc định toàn trang.
- SVG gốc tải từ Figma nằm ở `public/icons/tech-store/`, giữ kích thước gốc. Chevron quantity/select được xoay ở CSS theo thiết kế.
- Ảnh sản phẩm mẫu nằm ở `public/images/tech-store/msi-pro-16.png`; ảnh sản phẩm thực truyền qua `imageSrc`. Với ảnh ngoài domain, cấu hình `images.remotePatterns` theo nguồn ảnh trong ứng dụng.
- Không dùng URL asset Figma tạm thời trong component.
- CSS hỗ trợ focus, disabled và co giãn; trang preview dùng để kiểm tra ở desktop/mobile. Đây là bộ component, chưa triển khai toàn bộ các màn hình Figma hoặc tích hợp backend.

## Ví dụ

```tsx
"use client";

import { useState } from "react";
import { ProductCard, Button, QuantityInput } from "@/components/common";

export function ProductExample() {
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);

  return (
    <>
      <QuantityInput value={quantity} onValueChange={setQuantity} max={5} />
      <ProductCard
        name="PC PHUB Creator RTX"
        href="/main/product"
        imageSrc="/images/about/quality.webp"
        amount={499}
        originalAmount={599}
        rating={4}
        reviewCount={4}
        stock="in-stock"
        actions={<Button onClick={() => setCartCount(cartCount + quantity)}>Add to Cart</Button>}
      />
      <output>{cartCount} items</output>
    </>
  );
}
```

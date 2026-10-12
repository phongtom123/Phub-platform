# Catalog UI

## Tích hợp API hiện tại

Catalog và chi tiết đã kết nối API công khai, dùng chung dữ liệu desktop/mobile.
Xem [CATALOG-INTEGRATION.md](../../../CATALOG-INTEGRATION.md) để chạy ứng dụng,
cấu hình backend, xem phạm vi chức năng và kiểm tra. `CatalogExperience` quản lý
dữ liệu/URL; desktop dùng `CatalogPage`, mobile dùng `HomePage2` ở mốc 760px.
Giá/loại/thương hiệu/ảnh/thông số đọc từ API; các bộ lọc chưa hỗ trợ bị vô hiệu hóa.

**Các ghi chú bên dưới lưu lịch sử thiết kế và fixtures trước khi tích hợp API;
số lượng, giá và trạng thái mẫu không còn được dùng trên route catalog thật.**

Open `/main/product` (grid) or `/main/product?view=list` (list). Uses the existing root Header/Footer. Product previews now link to `/main/product/[id]`, merged from commit 699ff4c; see `Frontend/MERGE-NOTES.md`. No authentication, real cart, payment service or API is connected.

At widths up to 760px, the route composes `components/mobile/home-page-2/HomePage2.tsx` (Figma `174:9220`). The existing desktop `CatalogPage.tsx` remains in place above that breakpoint. The mobile header is the compact state of reusable `AltHeader.tsx`. `Menu1.tsx` and `Menu2.tsx` live under `components/mobile/menu`; selecting a child navigates to `/main/product?menuCategory=…&menuItem=…` and shows its Vietnamese title and breadcrumb.

## Components

- `CatalogPage`: applied/draft filters, active chips, grid/list layout, pagination and expandable description.
- `CatalogSidebar`: categories, price bands, color, availability, brands, comparison/wishlist empty states and chair promotion.
- `CatalogToolbar`: result range, sort order, page size and view controls.
- `CatalogPreview`: native accessible dialog; Escape/backdrop dismissal, focus restoration and body scroll lock.
- `catalogData`: typed deterministic fixtures and pure filter/sort helpers.
- `components/mobile/home-page-2/HomePage2`: mobile composition and filter/sort/page state; `HomePage2Description` and `HomePage2Extras` keep the page modular. `homePage2Data.ts` contains its translated mock text, sort options and Figma image mapping.

Reuses `common/ProductCard`, `Pagination`, `Breadcrumb`, `Button`, `SelectField`, `FilterOption`, `Accordion`, `ColorSwatch`, `BrandTile`, `IconButton`, `Price` and `StockStatus`. Page-specific composition and styling stay in this folder.

The mobile frame uses twelve cards per page, with functional filters, sorting, pagination and product preview. Its product art and chair banner are local Figma exports under `public/images/figma-mobile/catalog-*`; product titles and descriptive copy are Vietnamese. The fixture count and page count follow the available mock products, so they differ from the inconsistent range/page numbers visible in the design. Category branches beyond the Figma Desktop PCs branch remain demo taxonomy until catalog data is connected.

## Demo behavior and design differences

The supplied screenshot is the visual reference; Figma reads were unavailable due to quota. The ASUS banner, chair promotion and brand logos match available project assets. MSI PS42/PS63 product photography is illustrative and not an exact match to every screenshot angle/model. Existing Vietnamese header/footer are preserved.

There are 61 fixtures. The initial two selected category tags match 20 products, so the initial page shows 20 cards, `Items 1–20 of 20`, and one page. Choose 10 per page to try pagination, or clear filters to expose all 61. Counts/page controls deliberately reflect actual fixture results rather than the screenshot's inconsistent title, range and page count.

Category/color tags follow the screenshot's UI, not actual manufacturer taxonomy or physical product colors. All products use MSI imagery; choosing another brand correctly displays an empty state. Prices, stock, reviews and configurations are sample values.

Sidebar category/price/color/stock selections are drafts until **Apply Filters**. Removing chips, clearing filters and selecting a brand apply immediately. Price bands are lower-inclusive / upper-exclusive. Every filter, sort and page-size change resets to page one. Mobile filters collapse after applying. List View uses `common/ProductListCard` and defaults to 4 rows per page; each view remembers its own page size. Compare/wishlist controls populate local sidebar lists. Cart/enquiry actions provide demo feedback only; none persist account data or send messages.

## Asset provenance

All images are local; no third-party runtime requests.

- Banner: existing `/images/home/banner-asus.png`, originally the user's `web2/asset/public/uploads/images/Group 57.png`.
- Chair: copied from `C:/xampp/htdocs/web2/asset/public/uploads/images/image 49.png` to `/images/catalog/chair-promotion.png`.
- Brands: existing `/images/brands/*.png`.
- Laptop media: official MSI galleries https://www.msi.com/Content-Creation/PS42-8RX/Gallery and https://www.msi.com/Content-Creation/PS63-MODERN-8RX/Gallery. Source base: `https://storage-asset.msi.com/global/picture/product/`.

| Local filename | Source filename |
| --- | --- |
| prestige-front.webp | product_8_20190220133501_5c6ce705603d8.webp |
| prestige-angle.webp | product_3_20190220133505_5c6ce709213b4.webp |
| prestige-back.webp | product_10_20190220133507_5c6ce70b55294.webp |
| ps63-front.webp | product_6_20181206104840_5c088e083101f.webp |
| ps63-back.webp | product_8_20181206104840_5c088e088d075.webp |

Gallery filenames are local identifiers, not guaranteed camera angles. Confirm image/brand permissions before publishing commercially; MSI media is not assumed to be freely licensed.

## Verification

- ESLint on this folder and the route: passed.
- Scoped TypeScript for the route and imports: passed.
- Browser checks: HTTP 200, default 20 cards, six viewport sizes (320–1920px), no horizontal page overflow or missing images.
- Tested page-size changes/pagination, descending price sorting, grid/list switch, preview/Escape, color/category/brand filters, empty state/reset, expanded description, and mobile filter apply/collapse. No browser runtime errors.
- The merged outside Frontend passed full production build and browser checks; see `MERGE-NOTES.md`. Local test scripts/screenshots are development artifacts under `.next/`.

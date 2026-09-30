# Home UI

Route: `/` (`src/app/page.tsx`). Uses the existing root Header/Footer, without changing their current Vietnamese content or navigation.

- `HomePage1`: composes the first homepage and owns preview state (`src/components/home/HomePage1.tsx`, Figma `174:4764`).
- `HeroBanner`: two manually controlled promotions; no autoplay/timer.
- `ProductShelf`: scrollable new products and category rows; keyboard-accessible series tabs.
- `HomeDialog`: native modal dialog for product previews, all-products lists and the Zip disclaimer. Escape closes the dialog, with browser focus trapping/restoration.
- `homeData`: typed fixtures, independent of APIs. Series names/images are illustrative, not verified product configurations. Prices, reviews and stock are not live.
- Reuses `common/ProductCard`, `BrandTile`, `Price`, `StockStatus` and `Button`; page-specific components stay here instead of expanding `common` prematurely.
- `HomePage1`, `HeroBanner`, `ProductShelf`, `FinancingStrip` and `BrandSection` render at both desktop and mobile sizes. Mobile-only testimonials are in `components/mobile/home-page-1/`; service benefits shared by both mobile pages are in `components/mobile/shared/`.

Desktop spacing follows the supplied Home screenshot, including the large whitespace above the footer. Small screens use horizontally scrollable product rows and shorter bottom spacing. No cart, checkout, financing or Messenger connection is implemented. The floating contact button links to the existing footer contact details. Product clicks open a preview rather than navigating to the unfinished product route.

## Assets

All assets are served locally from `public/images/home`; no runtime third-party image requests.

- `banner-msi.png`, `banner-asus.png` and `category-*.png`: copied from the user's existing `C:/xampp/htdocs/web2/asset/public/uploads/images` (`Group 56.png`, `Group 57.png`, `image 30.png`, `image 30 (1).png`, `image 30 (2).png`, `image 30 (3).png`). Promotional wording/dates are baked into these demo images, not a current offer.
- Custom PC / laptop / desktop SVG images and Zip logo: public Tech Store design reference at https://tech-store-ruby.vercel.app/. Original asset paths are recorded below. These SVGs contain raster product artwork; no website code was imported.
- Monitor images: MSI official media (substitutes for the precise screenshot variants): https://storage-asset.msi.com/global/picture/product/product_7_20190802154807_5d43eab791593.webp and https://storage-asset.msi.com/event/2021/cnd/3M-Monitor/OptixG271.png.
- Brand logos and MSI Pro 16: reused existing project assets.

Confirm asset licensing/brand permissions and replace mock promotions/product content before a commercial launch. The screenshot was the visual reference because the Figma MCP read quota was exhausted.

## Validation

- `npx eslint src/app/page.tsx src/components/home`: passed.
- Scoped TypeScript program covering the Home route and its imports: passed.
- Browser checks at 1920, 1440, 1024, 768, 390 and 320px: no document horizontal overflow or broken Home images.
- Verified both promotion controls, product scrolling, series tabs (including arrow keys), catalog and product previews, Escape dismissal and Zip disclaimer. No browser runtime errors.
- The merged outside Frontend passed full production build; see `MERGE-NOTES.md`. Product previews now link to the merged detail route. Browser-check scripts/screenshots are development artifacts under `.next/`.

| Local file | Reference `/assets/` filename |
| --- | --- |
| custom-charlie.svg | image1.fbe250b3.svg |
| custom-bravo.svg | image2.99123e7f.svg |
| custom-alpha.svg | image3.c9a6bb2a.svg |
| custom-delta.svg | image4.5ec7ff62.svg |
| custom-zulu.svg | image5.3a12fce9.svg |
| laptop-green.svg | image1.808b7931.svg |
| laptop-red.svg | image2.b4968d0a.svg |
| laptop-stealth.svg | image3.3997a648.svg |
| desktop-trident.svg | image4.f8746fba.svg |
| desktop-infinite.svg | image1.f2947b6a.svg |
| desktop-glass.svg | image2.992c9e2e.svg |
| desktop-codex.svg | image3.0491a7bc.svg |
| zip.svg | Home_Logo_Commentary.f019d2b4.svg |

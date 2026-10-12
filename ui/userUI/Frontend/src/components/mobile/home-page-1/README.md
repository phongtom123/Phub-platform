# Home Page 1 — mobile sections

Source: Figma file `M9BdhkxCX2UwFNWv9OE6aS`, homepage `174:4764`, approved alternative header `174:7227`.

- Routes: `/` and `/main/landing`; shared Header/Footer remain in `app/layout.tsx`.
- Mobile breakpoint: 760px. Reference viewport: 375px. Browser chrome in the Figma mockup is not part of the website.
- `components/home/HomePage1.tsx` composes this responsive screen. The reusable `components/layout/AltHeader.tsx` owns header state; `components/mobile/header/MobileHeader.tsx`, `HeaderTopBar` and `components/mobile/menu/MobileCategoryDrawer.tsx` receive handlers. The homepage header uses a 40px information bar and a 110px blue toolbar/search area.
- Homepage reuses `ProductCard`, `Rating`, `Price`, `StockStatus`, `BrandTile` and existing shelf/carousel logic. New product cards use a compact mobile variant; category cards remain 234px wide with horizontal scrolling.
- Brand grid, testimonials, service benefits and accordion footer follow the mobile frame. Text is Vietnamese; brand/model names and USD sample prices are retained. English embedded in the original promotional raster image is retained to avoid altering the supplied asset.
- Shared mock content stays in `components/home/homeData.ts`, `components/layout/headerData.ts` and `footerData.ts`. Mobile-only review content is in `testimonialsData.ts`; service-benefit data shared by both mobile pages is in `components/mobile/shared/serviceBenefitsData.ts`.
- Assets are local under `public/images/figma-mobile`. Four category backgrounds are exports of image layers (not screenshots of composed UI); other images/icons come from Figma asset downloads. Several initially supplied 32px empty image responses were replaced with the actual image-layer exports/raw images.
- Search, newsletter, product previews and cart retain the existing demo behavior. The cart badge remains zero because the existing cart preview is empty. No backend integration was added.
- Desktop uses existing image sources and layout; common components expose optional mobile/language props so other callers retain their defaults.

Validation: production build, TypeScript, scoped ESLint, browser checks at 320/375/390/760/1440px; no document horizontal overflow, failed visible images or runtime errors. Checked menu/account/cart panels, Escape, search feedback, product tabs, Zip dialog, footer expansion and email validation. Browser review scripts/screenshots are disposable files under `.next/cache/mobile-review/`.

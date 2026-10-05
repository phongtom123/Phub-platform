import type { ProductCardProps } from "@/components/common/ProductCard";

export type HomeProduct = Pick<ProductCardProps, "name" | "imageSrc" | "amount" | "originalAmount" | "stock" | "rating" | "reviewCount" | "mobileImageSrc" | "currency" | "locale"> & { id: string };
export interface ProductGroup { label: string; products: HomeProduct[] }
export interface HomeCategory { id: string; title: string; image: string; mobileImage: string; groups: ProductGroup[] }

// Presentation fixtures only. Prices, stock and reviews are not live inventory.
function product(id: string, name: string, image: string, stock: HomeProduct["stock"] = "in-stock"): HomeProduct {
  return { id, name, imageSrc: `/images/home/${image}`, amount: 499, originalAmount: 499, stock, rating: 4, reviewCount: 4 };
}
const custom = [
  product("charlie", "CHARLIE V6 — PC gaming RGB lắp ráp", "custom-charlie.svg"),
  product("bravo", "BRAVO V6 — PC gaming hiệu năng cao", "custom-bravo.svg"),
  product("alpha", "ALPHA V6 — PC gaming nhỏ gọn", "custom-alpha.svg"),
  product("zulu", "ZULU V6 — Máy trạm lắp ráp", "custom-zulu.svg"),
  product("delta", "DELTA V6 — PC gaming RGB lắp ráp", "custom-delta.svg"),
];
const laptopImages = ["laptop-green.svg", "laptop-red.svg", "laptop-stealth.svg", "laptop-stealth.svg", "laptop-green.svg"];
const desktopImages = ["desktop-infinite.svg", "desktop-glass.svg", "desktop-codex.svg", "desktop-codex.svg", "desktop-trident.svg"];

export const newProducts: HomeProduct[] = [
  { ...product("pro-16", "HÀNG TRƯNG BÀY: MSI Pro 16 Flex — Máy tính cảm ứng đa điểm", ""), imageSrc: "/images/tech-store/msi-pro-16.png" },
  product("compact-pc", "MSI Trident — PC gaming nhỏ gọn", "desktop-infinite.svg"),
  { ...product("trident-pc", "MSI MPG Trident 3", "desktop-trident.svg"), amount: 3299, originalAmount: 3299 },
  product("gaming-laptop", "MSI Gaming Laptop — Laptop hiệu năng cao", "laptop-red.svg"),
  product("trident-rgb", "MSI Trident — PC hiệu năng cao", "desktop-trident.svg"),
  product("trident-plus", "MSI Trident — PC gaming Plus", "desktop-trident.svg"),
  custom[0], custom[2],
];
export const categories: HomeCategory[] = [
  { id: "custom-builds", title: "PC lắp ráp", image: "category-custom.png", mobileImage: "/images/figma-mobile/home-imgImage30.png", groups: [{ label: "PC lắp ráp", products: custom }] },
  { id: "msi-laptops", title: "Laptop MSI", image: "category-laptops.png", mobileImage: "/images/figma-mobile/home-imgImage31.png", groups: ["MSI GS Series", "MSI GT Series", "MSI GL Series", "MSI GE Series"].map((label, group) => ({ label, products: laptopImages.map((_, index) => product(`laptop-${group}-${index}`, `${label} — Laptop gaming ${index + 1}`, laptopImages[(index + group) % laptopImages.length])) })) },
  { id: "desktops", title: "Máy tính để bàn", image: "category-desktops.png", mobileImage: "/images/figma-mobile/home-imgImage32.png", groups: ["MSI Infinite Series", "MSI Trident", "MSI GL Series", "MSI Nightblade"].map((label, group) => ({ label, products: desktopImages.map((_, index) => product(`desktop-${group}-${index}`, `${label} — PC gaming ${index + 1}`, desktopImages[(index + group) % desktopImages.length])) })) },
  { id: "gaming-monitors", title: "Màn hình gaming", image: "category-monitors.png", mobileImage: "/images/figma-mobile/home-imgImage34.png", groups: [{ label: "Màn hình gaming", products: [
    product("monitor-1", "MSI Optix MAG272 — Màn hình gaming", "monitor-mag272.webp"),
    product("monitor-2", "MSI Optix MAG272 — Màn hình gaming, hàng trưng bày", "monitor-mag272.webp"),
    product("monitor-3", "MSI Optix G271 — Màn hình gaming", "monitor-g271.png"),
    product("monitor-4", "MSI Optix G271 — Màn hình gaming, hàng trưng bày", "monitor-g271.png"),
    product("monitor-5", "MSI Optix MAG272 — Màn hình gaming, hàng mở hộp", "monitor-mag272.webp"),
  ] }] },
];
export const brands = [
  { id: "roccat", name: "ROCCAT" }, { id: "msi", name: "MSI" },
  { id: "razer", name: "Razer" }, { id: "thermaltake", name: "Thermaltake" },
  { id: "adata", name: "ADATA" }, { id: "hp", name: "Hewlett Packard" },
  { id: "gigabyte", name: "Gigabyte" },
];

// Mobile assets correspond to the supplied Figma frame 174:4764.
newProducts[0].mobileImageSrc = "/images/figma-mobile/home-imgImage29.png";
newProducts[1].mobileImageSrc = "/images/figma-mobile/home-imgImage42.png";
const categoryMobileImages = [[43, 44], [45, 46], [45, 46], [47, 48]];
categories.forEach((category, index) => category.groups.forEach(group => group.products.forEach((item, productIndex) => {
  if (productIndex < 2) item.mobileImageSrc = `/images/figma-mobile/home-imgImage${categoryMobileImages[index][productIndex]}.png`;
})));

export const brandMobileImages: Record<string, string> = {
  roccat: "home-imgImage33.png", msi: "home-imgImage38.png", razer: "home-imgImage35.png",
  thermaltake: "home-imgImage39.png", adata: "home-imgImage36.png", hp: "home-imgImage40.png", gigabyte: "home-imgImage37.png",
};

export const heroSlides = [
  { image: "/images/home/banner-msi.png", mobileImage: "/images/figma-mobile/home-imgImage41.png", alt: "MSI — Ưu đãi màn hình gaming", href: "#desktops" },
  { image: "/images/home/banner-asus.png", mobileImage: "/images/home/banner-asus.png", alt: "ASUS TUF Gaming — Khám phá laptop gaming", href: "#msi-laptops" },
];

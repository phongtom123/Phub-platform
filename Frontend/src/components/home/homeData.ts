import type { ProductCardProps } from "@/components/common/ProductCard";

export type HomeProduct = Pick<ProductCardProps, "name" | "imageSrc" | "amount" | "originalAmount" | "stock" | "rating" | "reviewCount"> & { id: string };
export interface ProductGroup { label: string; products: HomeProduct[] }
export interface HomeCategory { id: string; title: string; image: string; groups: ProductGroup[] }

// Presentation fixtures only. Prices, stock and reviews are not live inventory.
function product(id: string, name: string, image: string, stock: HomeProduct["stock"] = "in-stock"): HomeProduct {
  return { id, name, imageSrc: `/images/home/${image}`, amount: 499, originalAmount: 599, stock, rating: 4, reviewCount: 4 };
}
const custom = [
  product("charlie", "CHARLIE V6 — Custom RGB Gaming Desktop PC", "custom-charlie.svg"),
  product("bravo", "BRAVO V6 — Custom Performance Gaming Desktop PC", "custom-bravo.svg"),
  product("alpha", "ALPHA V6 — Compact Custom Gaming Desktop PC", "custom-alpha.svg"),
  product("zulu", "ZULU V6 — Custom Workstation Desktop PC", "custom-zulu.svg"),
  product("delta", "DELTA V6 — Custom RGB Gaming Desktop PC", "custom-delta.svg"),
];
const laptopImages = ["laptop-green.svg", "laptop-red.svg", "laptop-stealth.svg", "laptop-stealth.svg", "laptop-green.svg"];
const desktopImages = ["desktop-infinite.svg", "desktop-glass.svg", "desktop-codex.svg", "desktop-codex.svg", "desktop-trident.svg"];

export const newProducts: HomeProduct[] = [
  { ...product("pro-16", "EX DISPLAY: MSI Pro 16 Flex — All-in-One Multitouch PC", ""), imageSrc: "/images/tech-store/msi-pro-16.png" },
  product("compact-pc", "MSI Trident — Compact Gaming Desktop PC", "desktop-infinite.svg", "check-availability"),
  product("trident-pc", "MSI Trident — RGB Gaming Desktop PC", "desktop-trident.svg"),
  product("gaming-laptop", "MSI Gaming Laptop — Performance Notebook", "laptop-red.svg"),
  product("trident-rgb", "MSI Trident — Performance Desktop PC", "desktop-trident.svg"),
  product("trident-plus", "MSI Trident — Gaming Desktop PC Plus", "desktop-trident.svg"),
  custom[0], custom[2],
];
export const categories: HomeCategory[] = [
  { id: "custom-builds", title: "Custom Builds", image: "category-custom.png", groups: [{ label: "Custom Builds", products: custom }] },
  { id: "msi-laptops", title: "MSI Laptops", image: "category-laptops.png", groups: ["MSI GS Series", "MSI GT Series", "MSI GL Series", "MSI GE Series"].map((label, group) => ({ label, products: laptopImages.map((_, index) => product(`laptop-${group}-${index}`, `${label} — Gaming Notebook ${index + 1}`, laptopImages[(index + group) % laptopImages.length])) })) },
  { id: "desktops", title: "Desktops", image: "category-desktops.png", groups: ["MSI Infinite Series", "MSI Trident", "MSI GL Series", "MSI Nightblade"].map((label, group) => ({ label, products: desktopImages.map((_, index) => product(`desktop-${group}-${index}`, `${label} — Gaming Desktop PC ${index + 1}`, desktopImages[(index + group) % desktopImages.length])) })) },
  { id: "gaming-monitors", title: "Gaming Monitors", image: "category-monitors.png", groups: [{ label: "Gaming Monitors", products: [
    product("monitor-1", "MSI Optix MAG272 — Gaming Monitor", "monitor-mag272.webp"),
    product("monitor-2", "MSI Optix MAG272 — Gaming Monitor, Display Model", "monitor-mag272.webp"),
    product("monitor-3", "MSI Optix G271 — Gaming Monitor", "monitor-g271.png"),
    product("monitor-4", "MSI Optix G271 — Gaming Monitor, Display Model", "monitor-g271.png"),
    product("monitor-5", "MSI Optix MAG272 — Gaming Monitor, Open Box", "monitor-mag272.webp"),
  ] }] },
];
export const brands = [
  { id: "roccat", name: "ROCCAT" }, { id: "msi", name: "MSI" },
  { id: "razer", name: "Razer" }, { id: "thermaltake", name: "Thermaltake" },
  { id: "adata", name: "ADATA" }, { id: "hp", name: "Hewlett Packard" },
  { id: "gigabyte", name: "Gigabyte" },
];

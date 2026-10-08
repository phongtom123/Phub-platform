import type { ProductCardProps } from "@/components/common/ProductCard";

export type CatalogProduct = Pick<ProductCardProps, "name" | "imageSrc" | "amount" | "originalAmount" | "stock" | "rating" | "reviewCount" | "currency" | "locale"> & {
  id: string; category: string; brand: string; color: string; position: number;
  sku: string; description: string; specifications: { label: string; value: string }[];
  categoryName?: string;
};
export interface CatalogFilters { categories: string[]; price: string; color: string; brand: string; inStock: boolean; minPrice: string; maxPrice: string; stockStatus: "" | "in-stock" | "out-of-stock" }
export type CatalogSort = "position" | "price-asc" | "price-desc" | "name";
export const emptyFilters: CatalogFilters = { categories: [], price: "", color: "", brand: "", inStock: false, minPrice: "", maxPrice: "", stockStatus: "" };
export const initialFilters: CatalogFilters = { ...emptyFilters, categories: ["custom", "hp"] };
export const categoryOptions = [{ id: "custom", label: "CUSTOM PCS" }, { id: "all-in-one", label: "MSI ALL-IN-ONE PCS" }, { id: "hp", label: "HP/COMPAQ PCS" }];
export const priceOptions = Array.from({ length: 8 }, (_, index) => ({ id: String(index), label: index === 7 ? "$7,000.00 And Above" : `$${(index * 1000).toLocaleString("en-US")}.00 - $${((index + 1) * 1000).toLocaleString("en-US")}.00`, min: index * 1000, max: index === 7 ? Infinity : (index + 1) * 1000 }));
export const catalogBrands = [{ id: "roccat", name: "ROCCAT" }, { id: "msi", name: "MSI" }, { id: "thermaltake", name: "Thermaltake" }, { id: "adata", name: "ADATA" }, { id: "hp", name: "Hewlett Packard" }, { id: "gigabyte", name: "Gigabyte" }];
const photos = ["prestige-back.webp", "ps63-front.webp", "prestige-back.webp", "prestige-front.webp", "prestige-front.webp", "prestige-front.webp", "prestige-back.webp", "prestige-front.webp", "prestige-front.webp", "prestige-angle.webp"];

// Deliberately illustrative catalog tags from the mockup, not real manufacturer taxonomy.
// The first twenty fixtures recreate the initial four-row view. Clearing filters exposes 61.
export const catalogProducts: CatalogProduct[] = Array.from({ length: 61 }, (_, index) => ({
  id: `ps-${String(index + 1).padStart(3, "0")}`,
  sku: `D55I5AI-${String(index + 1).padStart(2, "0")}`,
  description: "Thin Bezel Notebook — Windows 10 Pro Laptop",
  specifications: [{ label: "CPU", value: "N/A" }, { label: "Featured", value: "N/A" }, { label: "I/O Ports", value: "N/A" }],
  name: `EX DISPLAY: MSI ${index % 2 ? "PS63" : "PS42"} Prestige — ${index % 3 ? "16GB RAM / 512GB SSD" : "8GB RAM / 256GB SSD"} — Model ${String(index + 1).padStart(2, "0")}`,
  imageSrc: `/images/catalog/${photos[index % photos.length]}`,
  amount: index < 20 ? 499 : 499 + (index % 8) * 1000,
  originalAmount: index < 20 ? 599 : 599 + (index % 8) * 1000,
  stock: index < 20 || index % 4 ? "in-stock" : "check-availability",
  rating: 4, reviewCount: 4, brand: "msi", color: index % 2 ? "black" : "red",
  category: index < 20 ? (index % 2 ? "hp" : "custom") : "all-in-one", position: index,
}));

export function matchesFilters(product: CatalogProduct, filters: CatalogFilters) {
  const price = priceOptions.find(option => option.id === filters.price);
  return (!filters.categories.length || filters.categories.includes(product.category))
    && (!price || (product.amount >= price.min && product.amount < price.max))
    && (!filters.color || product.color === filters.color)
    && (!filters.brand || product.brand === filters.brand)
    && (!filters.inStock || product.stock === "in-stock");
}
export function selectProducts(filters: CatalogFilters, sort: CatalogSort) {
  return catalogProducts.filter(product => matchesFilters(product, filters)).sort((a, b) => {
    if (sort === "price-asc") return a.amount - b.amount || a.position - b.position;
    if (sort === "price-desc") return b.amount - a.amount || a.position - b.position;
    if (sort === "name") return a.name.localeCompare(b.name);
    return a.position - b.position;
  });
}
export function filterCount(filters: CatalogFilters) {
  return filters.categories.length + Number(Boolean(filters.price || filters.minPrice || filters.maxPrice)) + Number(Boolean(filters.color)) + Number(Boolean(filters.brand)) + Number(Boolean(filters.stockStatus || filters.inStock));
}

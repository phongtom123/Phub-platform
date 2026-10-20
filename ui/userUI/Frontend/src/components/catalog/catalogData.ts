import type { ProductCardProps } from "@/components/common/ProductCard";

export type CatalogProduct = Pick<ProductCardProps, "name" | "imageSrc" | "amount" | "originalAmount" | "stock" | "rating" | "reviewCount" | "currency" | "locale"> & {
  id: string; category: string; brand: string; color: string; position: number;
  subcategory: string;
  sku: string; description: string; specifications: { label: string; value: string }[];
  categoryName?: string; subcategoryName?: string;
};
export interface CatalogFilters { categories: string[]; subcategories: string[]; price: string; color: string; brand: string; inStock: boolean }
export type CatalogSort = "position" | "price-asc" | "price-desc" | "name";
export const emptyFilters: CatalogFilters = { categories: [], subcategories: [], price: "", color: "", brand: "", inStock: false };
export const initialFilters: CatalogFilters = { ...emptyFilters };
export const categoryOptions = [] as { id: string; label: string }[];
export const priceOptions = Array.from({ length: 8 }, (_, index) => ({ id: String(index), label: index === 7 ? "$7,000.00 And Above" : `$${(index * 1000).toLocaleString("en-US")}.00 - $${((index + 1) * 1000).toLocaleString("en-US")}.00`, min: index * 1000, max: index === 7 ? Infinity : (index + 1) * 1000 }));
export const catalogBrands = [] as { id: string; name: string }[];


// Không có bản ghi fallback; các trang lấy danh sách từ API.
export const catalogProducts: CatalogProduct[] = [];

export function matchesFilters(product: CatalogProduct, filters: CatalogFilters) {
  const price = priceOptions.find(option => option.id === filters.price);
  return (!filters.categories.length || filters.categories.includes(product.category))
    && (!filters.subcategories.length || filters.subcategories.includes(product.subcategory))
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
  return filters.categories.length + filters.subcategories.length + Number(Boolean(filters.price)) + Number(Boolean(filters.color)) + Number(Boolean(filters.brand)) + Number(filters.inStock);
}

import { emptyFilters, type CatalogFilters } from "@/components/catalog/catalogData";
import type { CatalogCategory } from "./types";

export function catalogHeading(filters: CatalogFilters, categories: CatalogCategory[]) {
  if (filters.subcategories.length === 1) return categories.flatMap(category => category.children).find(child => child.id === filters.subcategories[0])?.label ?? "Sản phẩm";
  if (!filters.subcategories.length && filters.categories.length === 1) return categories.find(category => category.id === filters.categories[0])?.label ?? "Sản phẩm";
  return "Sản phẩm";
}

export function filtersFromParams(params: Pick<URLSearchParams, "get" | "getAll">): CatalogFilters {
  const stock = params.get("stock_status");
  const specs: Record<string, string[]> = Object.create(null);
  for (const encoded of params.getAll("spec").slice(0, 40)) {
    try {
      const pair: unknown = JSON.parse(encoded);
      if (Array.isArray(pair) && pair.length === 2 && pair.every(value => typeof value === "string" && value.length > 0) && !["__proto__", "constructor", "prototype"].includes(pair[0])) {
        specs[pair[0]] = [...new Set([...(specs[pair[0]] ?? []), pair[1]])];
      }
    } catch { /* Ignore malformed links rather than breaking the search interface. */ }
  }
  return {
    ...emptyFilters, categories: params.getAll("category_id"), subcategories: params.getAll("subcategory_id"),
    brand: params.get("brand") || "", minPrice: params.get("min_price") || "", maxPrice: params.get("max_price") || "",
    color: params.get("color") || "", stockStatus: stock === "in-stock" || stock === "out-of-stock" ? stock : "",
    ...(Object.keys(specs).length ? { specs } : {}),
  };
}

export function priceFilterError(filters: CatalogFilters): string {
  const amounts = [filters.minPrice?.trim() || "", filters.maxPrice?.trim() || ""];
  if (amounts.some(value => value && !/^\d{1,16}(\.\d{1,2})?$/.test(value))) return "Giá phải là số không âm, tối đa 2 chữ số thập phân.";
  const toCents = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); };
  if (amounts.every(Boolean) && toCents(amounts[0]) > toCents(amounts[1])) return "Giá từ không được lớn hơn giá đến.";
  return "";
}

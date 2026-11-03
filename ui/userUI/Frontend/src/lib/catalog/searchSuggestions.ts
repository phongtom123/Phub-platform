import { formatCurrency } from "@/data/storefront-data";
import { emptyFilters, type CatalogFilters } from "@/components/catalog/catalogData";
import { getProducts } from "./client";
import { safeImageUrl } from "./types";

export interface SearchSuggestion {
  id: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number;
  currency: string;
  category?: string;
  brand?: string;
  imageSrc: string;
}

export function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export async function fetchSearchSuggestions(
  query: string,
  limit = 6,
  signal?: AbortSignal,
  filters: CatalogFilters = emptyFilters,
): Promise<{ items: SearchSuggestion[]; total: number }> {
  if (!query.trim()) return { items: [], total: 0 };
  const result = await getProducts({ q: query.trim(), filters, sort: "position", page: 1, pageSize: limit, view: "grid" }, signal);
  return {
    items: result.items.map(item => ({
      id: item.id, name: item.name, sku: item.sku, price: Number(item.price), currency: item.currency,
      category: item.category.name, brand: item.brand ?? undefined, imageSrc: safeImageUrl(item.images[0]?.url),
    })),
    total: result.pagination.total,
  };
}

export function formatPriceDisplay(amount: number, currency = "VND"): string {
  return formatCurrency(amount, currency);
}

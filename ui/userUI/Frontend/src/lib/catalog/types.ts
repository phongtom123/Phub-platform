import type { CatalogProduct, CatalogFilters, CatalogSort } from "@/components/catalog/catalogData";
import type { DetailProduct } from "@/data/product-details";

export interface ApiProduct {
  id: string; sku: string; name: string;
  category: { id: string; name: string }; brand: string | null;
  price: string; currency: string; description: string | null;
  unit: string; warranty_months: number;
  images: { url: string; alt: string }[];
  specifications: { label: string; value: string }[];
  specifications_text: string | null;
}
export interface CatalogMetadata {
  categories: { id: string; label: string }[];
  brands: { id: string; name: string }[];
}
export interface CatalogPagination { page: number; page_size: number; total: number; total_pages: number }
export interface ApiProductPage { items: ApiProduct[]; pagination: CatalogPagination }
export interface CatalogRequest {
  q: string; filters: CatalogFilters; sort: CatalogSort;
  page: number; pageSize: number; view: "grid" | "list";
}

export const placeholderImage = "/images/catalog/product-placeholder.svg";

export function safeImageUrl(value: string | undefined): string {
  if (!value?.trim()) return placeholderImage;
  const source = value.trim();
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  if (!source.includes(":") && !source.startsWith("//")) return `/${source}`;
  return placeholderImage;
}

export function catalogProduct(product: ApiProduct): CatalogProduct {
  return {
    id: product.id, sku: product.sku, name: product.name,
    category: product.category.id, categoryName: product.category.name,
    brand: product.brand ?? "", color: "", position: 0,
    amount: Number(product.price), currency: product.currency, locale: "vi-VN",
    imageSrc: safeImageUrl(product.images[0]?.url),
    description: product.description ?? "", specifications: product.specifications,
  };
}

export function detailProduct(product: ApiProduct): DetailProduct {
  return {
    id: product.id, sku: product.sku, name: product.name,
    brand: product.brand ?? "", category: product.category.name, categoryId: product.category.id,
    price: Number(product.price), currency: product.currency,
    imageSrc: safeImageUrl(product.images[0]?.url),
    images: product.images.map(image => ({ ...image, url: safeImageUrl(image.url) })),
    description: product.description ?? "", specifications: product.specifications,
    warrantyMonths: product.warranty_months, unit: product.unit, source: "api",
    visual: "", visualDetail: "", accent: "#0156ff",
  };
}

export function productHref(id: string): string {
  return `/main/product/${encodeURIComponent(id)}`;
}

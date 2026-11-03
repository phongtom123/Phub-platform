import type { CatalogFilters } from "./catalogData";
import { emptyFilters } from "./catalogData";
import type { CatalogMetadata, CatalogFacets } from "@/lib/catalog/types";
import styles from "./Catalog.module.css";

export function CatalogFilterChips({ filters, metadata, facets, onChange }: { filters: CatalogFilters; metadata: CatalogMetadata; facets?: CatalogFacets | null; onChange: (next: CatalogFilters) => void }) {
  const chips = [
    ...filters.categories.map(id => ({ key: `category:${id}`, label: metadata.categories.find(option => option.id === id)?.label ?? id, next: { ...filters, categories: filters.categories.filter(value => value !== id) } })),
    ...filters.subcategories.map(id => ({ key: `subcategory:${id}`, label: metadata.categories.flatMap(option => option.children).find(option => option.id === id)?.label ?? id, next: { ...filters, subcategories: filters.subcategories.filter(value => value !== id) } })),
    ...(filters.brand ? [{ key: "brand", label: filters.brand, next: { ...filters, brand: "" } }] : []),
    ...(filters.minPrice || filters.maxPrice ? [{ key: "price", label: `${filters.minPrice ? Number(filters.minPrice).toLocaleString("vi-VN") : "0"} đ – ${filters.maxPrice ? `${Number(filters.maxPrice).toLocaleString("vi-VN")} đ` : "không giới hạn"}`, next: { ...filters, minPrice: "", maxPrice: "" } }] : []),
    ...(filters.stockStatus || filters.inStock ? [{ key: "stock", label: filters.stockStatus === "out-of-stock" ? "Hết hàng" : "Còn hàng", next: { ...filters, stockStatus: "" as const, inStock: false } }] : []),
    ...(filters.color ? [{ key: "color", label: filters.color, next: { ...filters, color: "" } }] : []),
    ...Object.entries(filters.specs ?? {}).flatMap(([key, values]) => values.map(value => ({ key: `spec:${key}:${value}`, label: `${facets?.specs.find(facet => facet.key === key)?.label ?? key}: ${value}`, next: { ...filters, specs: { ...filters.specs, [key]: values.filter(item => item !== value) } } }))),
  ];
  if (!chips.length) return null;
  return <div className={styles.chips} aria-label="Bộ lọc đang áp dụng">
    {chips.map(chip => <button key={chip.key} onClick={() => onChange(chip.next)} aria-label={`Xóa bộ lọc ${chip.label}`}>{chip.label}<span aria-hidden="true">×</span></button>)}
    <button onClick={() => onChange({ ...emptyFilters, categories: filters.categories, subcategories: filters.subcategories })}>Xóa bộ lọc</button>
  </div>;
}

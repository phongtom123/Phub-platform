"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { SearchInput } from "@/components/common/SearchInput";
import { PriceStockFilters } from "@/components/catalog/PriceStockFilters";
import { emptyFilters, filterCount, type CatalogSort } from "@/components/catalog/catalogData";
import { useCatalogMetadata } from "@/lib/catalog/useCatalog";
import { queryFor } from "@/lib/catalog/client";
import { filtersFromParams, priceFilterError } from "@/lib/catalog/filters";
import fields from "@/components/catalog/SearchFilters.module.css";
import styles from "./HeaderSearch.module.css";

export function HeaderSearch({ onNavigate }: { onNavigate: (href: string) => void }) {
  const params = useSearchParams();
  const pathname = usePathname();
  return <HeaderSearchForm key={`${pathname}?${params}`} params={params} onNavigate={onNavigate} />;
}

function HeaderSearchForm({ params, onNavigate }: { params: ReadonlyURLSearchParams; onNavigate: (href: string) => void }) {
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filters, setFilters] = useState(() => filtersFromParams(params));
  const [sort, setSort] = useState<CatalogSort>(() => params.get("sort") === "price-asc" ? "price-asc" : params.get("sort") === "price-desc" ? "price-desc" : "position");
  const [expanded, setExpanded] = useState(false);
  const metadata = useCatalogMetadata(expanded);
  const root = useRef<HTMLDivElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function dismiss(event: Event) { if (!root.current?.contains(event.target as Node)) setExpanded(false); }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && expanded) { setExpanded(false); filterTrigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", dismiss); document.addEventListener("focusin", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("focusin", dismiss); document.removeEventListener("keydown", escape); };
  }, [expanded]);
  const id = useId();
  const count = filterCount(filters);
  const error = priceFilterError(filters);
  const children = metadata.data.categories.filter(category => !filters.categories.length || filters.categories.includes(category.id)).flatMap(category => category.children);
  function search(value: string) {
    if (error) { setExpanded(true); return; }
    const next = queryFor({ q: value, filters, sort, page: 1, pageSize: 20, view: "grid" });
    if (sort === "position") next.delete("sort");
    onNavigate(`/main/product?${next}`);
  }
  return <div ref={root} className={styles.root}>
    <div className={styles.row}>
      <SearchInput initialQuery={query} onQueryChange={setQuery} allowEmpty={count > 0} className={styles.searchForm} submitText="Tìm kiếm"
        maxLength={100} placeholder="Bạn tìm gì…" suggestionFilters={filters} suggestionsEnabled={!expanded && !error}
        onSearch={search} onSelectProduct={product => onNavigate(`/main/product/${encodeURIComponent(product.id)}`)} />
      <button ref={filterTrigger} type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="white" /><circle cx="15" cy="17" r="3" fill="white" /></svg>
        Bộ lọc{count > 0 && <span>{count}</span>}
      </button>
    </div>
    {expanded && <form id={id} className={styles.panel} aria-label="Bộ lọc tìm kiếm" onSubmit={event => { event.preventDefault(); search(query); }}>
      <div className={styles.heading}><div><h2>Lọc sản phẩm</h2><p>Kết hợp nhiều điều kiện để tìm đúng sản phẩm.</p></div><button type="button" className={styles.clear} onClick={() => { setFilters(emptyFilters); setSort("position"); }}>Xóa bộ lọc</button></div>
      {metadata.loading && <p role="status">Đang tải danh mục và thương hiệu…</p>}
      {metadata.error && <p role="alert">{metadata.error} <button type="button" className={styles.clear} onClick={metadata.retry}>Thử lại bộ lọc</button></p>}
      <div className={styles.grid}>
        <label className={fields.field}>Danh mục<select value={filters.categories[0] ?? ""} disabled={metadata.loading} onChange={event => setFilters({ ...filters, categories: event.target.value ? [event.target.value] : [], subcategories: [], specs: {}, brand: "" })}>
          <option value="">Tất cả danh mục</option>{metadata.data.categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select></label>
        <label className={fields.field}>Loại sản phẩm<select value={filters.subcategories[0] ?? ""} disabled={metadata.loading || !children.length} onChange={event => setFilters({ ...filters, subcategories: event.target.value ? [event.target.value] : [], specs: {}, brand: "" })}>
          <option value="">Tất cả loại sản phẩm</option>{children.map(child => <option key={child.id} value={child.id}>{child.label}</option>)}
        </select></label>
        <label className={fields.field}>Thương hiệu<select value={filters.brand} disabled={metadata.loading} onChange={event => setFilters({ ...filters, brand: event.target.value })}>
          <option value="">Tất cả thương hiệu</option>{metadata.data.brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select></label>
        <PriceStockFilters value={filters} onChange={setFilters} />
        <label className={fields.field}>Sắp xếp<select value={sort} onChange={event => setSort(event.target.value as CatalogSort)}><option value="position">Mặc định</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label>
      </div>
      <div className={styles.footer}><span>{count ? `Đã chọn ${count} điều kiện lọc` : "Có thể để trống từ khóa khi dùng bộ lọc."}</span><button type="submit" className={styles.apply} disabled={!!error}>Xem kết quả</button></div>
    </form>}
  </div>;
}

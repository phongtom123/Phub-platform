"use client";

import { SelectField } from "@/components/common/SelectField";
import { IconButton } from "@/components/common/icon";
import type { CatalogSort } from "./catalogData";
import { homePage2SortOptions } from "@/components/mobile/home-page-2/homePage2Data";
import styles from "./Catalog.module.css";
import mobileStyles from "@/components/mobile/home-page-2/HomePage2.module.css";

interface Props { start: number; end: number; total: number; sort: CatalogSort; pageSize: number; view: "grid" | "list"; onSort: (value: CatalogSort) => void; onPageSize: (value: number) => void; onView: (value: "grid" | "list") => void; mobile?: boolean; filtersOpen?: boolean; onFilter?: () => void }
export function CatalogToolbar({ start, end, total, sort, pageSize, view, onSort, onPageSize, onView, mobile = false, filtersOpen = false, onFilter }: Props) {
  if (mobile) return <div className={mobileStyles.mobileToolbar}>
    <div className={mobileStyles.toolbarButtons}>
      <button type="button" className={mobileStyles.filterButton} aria-expanded={filtersOpen} aria-controls="homepage2-filters" onClick={onFilter}>Lọc</button>
      <SelectField label="Sắp xếp:" className={mobileStyles.sortSelect} value={sort} onChange={event => onSort(event.target.value as CatalogSort)} options={homePage2SortOptions} />
    </div>
    <p className={mobileStyles.resultCount} role="status">Sản phẩm {start}–{end} trong {total}</p>
  </div>;
  return <div className={styles.toolbar}>
    <p className={styles.resultCount} role="status">Items {start}–{end} of {total}</p>
    <div className={styles.sortControls}>
      <SelectField label="Sort By:" className={styles.toolbarSelect} value={sort} onChange={event => onSort(event.target.value as CatalogSort)} options={[{ value: "position", label: "Position" }, { value: "price-asc", label: "Price: Low to High" }, { value: "price-desc", label: "Price: High to Low" }, { value: "name", label: "Name" }]} />
      <SelectField label="Show:" className={styles.toolbarSelect} value={String(pageSize)} onChange={event => onPageSize(Number(event.target.value))} options={(view === "list" ? [4, 10, 20] : [10, 20, 35]).map(value => ({ value: String(value), label: `${value} per page` }))} />
      <div className={styles.viewControls} aria-label="Product view" role="group">
        <IconButton label="Grid view" aria-pressed={view === "grid"} onClick={() => onView("grid")}><svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <rect key={index} x={2 + index % 3 * 7} y={2 + Math.floor(index / 3) * 7} width="4" height="4" />)}</svg></IconButton>
        <IconButton label="List view" aria-pressed={view === "list"} onClick={() => onView("list")}><svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><path d="M2 3h18v3H2zm0 6h18v3H2zm0 6h12v3H2z" /></svg></IconButton>
      </div>
    </div>
  </div>;
}

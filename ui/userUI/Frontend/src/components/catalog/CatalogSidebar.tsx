"use client";

import { Accordion } from "@/components/common/Accordion";
import { Button } from "@/components/common/Button";
import { FilterOption } from "@/components/common/FilterOption";
import { BrandTile } from "@/components/common/BrandTile";
import { CatalogSelectionPanel } from "./CatalogSelectionPanel";
import { filterCount, type CatalogFilters, type CatalogProduct } from "./catalogData";
import type { CatalogController } from "@/lib/catalog/useCatalog";
import styles from "./Catalog.module.css";

interface Props {
  draft: CatalogFilters; onChange: (value: CatalogFilters) => void; onApply: () => void; onClear: () => void; onBrand: (brand: string) => void; activeBrand: string;
  compared: CatalogProduct[]; wished: CatalogProduct[]; onCompare: (product: CatalogProduct) => void; onWish: (product: CatalogProduct) => void; onSelect: (product: CatalogProduct) => void;
  metadata: CatalogController["metadata"]; locale?: "en" | "vi"; filtersOnly?: boolean;
}
const logos: Record<string, string> = { msi: "msi", hp: "hp", "hewlett packard": "hp", adata: "adata", gigabyte: "gigabyte", thermaltake: "thermaltake", roccat: "roccat" };

export function CatalogSidebar({ draft, onChange, onApply, onClear, onBrand, activeBrand, compared, wished, onCompare, onWish, onSelect, metadata, filtersOnly = false }: Props) {
  return <>
    <section className={styles.filters} aria-labelledby="filters-heading">
      <div className={styles.filterHeading}><h2 id="filters-heading">Bộ lọc</h2><Button variant="outline" onClick={onClear}>Xóa bộ lọc</Button></div>
      {metadata.loading && <p role="status">Đang tải bộ lọc…</p>}
      {metadata.error && <div role="alert"><p>{metadata.error}</p><Button onClick={metadata.retry}>Thử lại bộ lọc</Button></div>}
      <Accordion title="Danh mục" open className={styles.filterGroup}>
        {metadata.data.categories.map(option => <FilterOption key={option.id} label={option.label} selected={draft.categories.includes(option.id)} onClick={() => onChange({ ...draft, categories: draft.categories.includes(option.id) ? draft.categories.filter(id => id !== option.id) : [...draft.categories, option.id] })} />)}
      </Accordion>
      {["Khoảng giá", "Màu sắc", "Tình trạng tồn kho"].map(title => <Accordion key={title} title={title} className={styles.filterGroup}><FilterOption label="Chưa khả dụng" disabled /></Accordion>)}
      <div className={styles.apply}><Button onClick={onApply} disabled={metadata.loading}>Áp dụng ({filterCount(draft)})</Button></div>
    </section>
    {!filtersOnly && <>
      <section className={styles.brandSection} aria-labelledby="catalog-brands-heading">
        <div className={styles.filterHeading}><h2 id="catalog-brands-heading">Thương hiệu</h2><Button variant="outline" onClick={() => onBrand("")}>Tất cả</Button></div>
        <div className={styles.brandGrid}>{metadata.data.brands.map(brand => {
          const logo = logos[brand.name.toLowerCase()];
          return <button key={brand.id} aria-label={ `Lọc theo ${brand.name}` } aria-pressed={activeBrand === brand.id} onClick={() => onBrand(activeBrand === brand.id ? "" : brand.id)}>
            {logo ? <BrandTile src={ `/images/brands/${logo}.png` } name={brand.name} width={153} height={80} containerClassName={styles.brandTile} /> : <span>{brand.name}</span>}
          </button>;
        })}</div>
      </section>
      <CatalogSelectionPanel locale="vi" title="So sánh sản phẩm" emptyText="Bạn chưa có sản phẩm để so sánh." products={compared} onRemove={onCompare} onSelect={onSelect} />
      <CatalogSelectionPanel locale="vi" title="Danh sách yêu thích" emptyText="Bạn chưa có sản phẩm yêu thích." products={wished} onRemove={onWish} onSelect={onSelect} />
    </>}
  </>;
}

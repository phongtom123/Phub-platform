"use client";

import Image from "next/image";
import { Accordion } from "@/components/common/Accordion";
import { Button } from "@/components/common/Button";
import { FilterOption } from "@/components/common/FilterOption";
import { ColorSwatch } from "@/components/common/ColorSwatch";
import { BrandTile } from "@/components/common/BrandTile";
import { CatalogSelectionPanel } from "./CatalogSelectionPanel";
import { catalogBrands, catalogProducts, categoryOptions, filterCount, matchesFilters, priceOptions, type CatalogFilters, type CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

interface Props {
  draft: CatalogFilters; onChange: (value: CatalogFilters) => void; onApply: () => void; onClear: () => void; onBrand: (brand: string) => void; activeBrand: string;
  compared: CatalogProduct[]; wished: CatalogProduct[]; onCompare: (product: CatalogProduct) => void; onWish: (product: CatalogProduct) => void; onSelect: (product: CatalogProduct) => void;
  locale?: "en" | "vi"; filtersOnly?: boolean;
}
export function CatalogSidebar({ draft, onChange, onApply, onClear, onBrand, activeBrand, compared, wished, onCompare, onWish, onSelect, locale = "en", filtersOnly = false }: Props) {
  const vi = locale === "vi";
  function toggleCategory(id: string) {
    onChange({ ...draft, categories: draft.categories.includes(id) ? draft.categories.filter(value => value !== id) : [...draft.categories, id] });
  }
  return <>
    <section className={styles.filters} aria-labelledby="filters-heading">
      <div className={styles.filterHeading}><h2 id="filters-heading">{vi ? "Bộ lọc" : "Filters"}</h2><Button variant="outline" onClick={onClear}>{vi ? "Xóa bộ lọc" : "Clear Filter"}</Button></div>
      <Accordion title={vi ? "Danh mục" : "Category"} open className={styles.filterGroup}>
        {categoryOptions.map(option => <FilterOption key={option.id} label={vi ? ({ custom: "PC lắp ráp", "all-in-one": "PC All-in-One MSI", hp: "PC HP/Compaq" }[option.id] ?? option.label) : option.label} count={catalogProducts.filter(product => matchesFilters(product, { ...draft, categories: [option.id] })).length} selected={draft.categories.includes(option.id)} onClick={() => toggleCategory(option.id)} />)}
      </Accordion>
      <Accordion title={vi ? "Giá" : "Price"} open className={styles.filterGroup}>
        {priceOptions.map(option => <FilterOption key={option.id} label={option.label} count={catalogProducts.filter(product => matchesFilters(product, { ...draft, price: option.id })).length} selected={draft.price === option.id} onClick={() => onChange({ ...draft, price: draft.price === option.id ? "" : option.id })} />)}
      </Accordion>
      <Accordion title={vi ? "Màu sắc" : "Color"} open className={styles.filterGroup}>
        <div className={styles.colors} role="radiogroup" aria-label={vi ? "Màu sản phẩm" : "Product color"}>
          <ColorSwatch name="catalog-color" label={vi ? "Đen" : "Black"} color="#000" checked={draft.color === "black"} onChange={() => onChange({ ...draft, color: "black" })} />
          <ColorSwatch name="catalog-color" label={vi ? "Đỏ" : "Red"} color="#ff0000" checked={draft.color === "red"} onChange={() => onChange({ ...draft, color: "red" })} />
        </div>
      </Accordion>
      <Accordion title={vi ? "Tình trạng" : "Filter Name"} className={styles.filterGroup}>
        <label className={styles.stockCheck}><input type="checkbox" checked={draft.inStock} onChange={event => onChange({ ...draft, inStock: event.target.checked })} />{vi ? "Chỉ sản phẩm còn hàng" : "In stock only"}</label>
      </Accordion>
      <div className={styles.apply}><Button onClick={onApply}>{vi ? "Áp dụng" : "Apply Filters"} ({filterCount(draft)})</Button></div>
    </section>
    {!filtersOnly && <>
    <section className={styles.brandSection} aria-labelledby="catalog-brands-heading">
      <div className={styles.filterHeading}><h2 id="catalog-brands-heading">{vi ? "Thương hiệu" : "Brands"}</h2><Button variant="outline" onClick={() => onBrand("")}>{vi ? "Tất cả thương hiệu" : "All Brands"}</Button></div>
      <div className={styles.brandGrid}>{catalogBrands.map(brand => <button key={brand.id} aria-label={`Filter by ${brand.name}`} aria-pressed={activeBrand === brand.id} onClick={() => onBrand(activeBrand === brand.id ? "" : brand.id)}><BrandTile src={`/images/brands/${brand.id}.png`} name={brand.name} width={153} height={80} containerClassName={styles.brandTile} /></button>)}</div>
    </section>
    <CatalogSelectionPanel title={vi ? "So sánh sản phẩm" : "Compare Products"} emptyText={vi ? "Bạn chưa có sản phẩm để so sánh." : "You have no items to compare."} products={compared} onRemove={onCompare} onSelect={onSelect} />
    <CatalogSelectionPanel title={vi ? "Danh sách yêu thích" : "My Wish List"} emptyText={vi ? "Bạn chưa có sản phẩm yêu thích." : "You have no items in your wish list."} products={wished} onRemove={onWish} onSelect={onSelect} />
    <Image className={styles.chair} src="/images/catalog/chair-promotion.png" alt="noblechairs — The Icon Series. Become iconic." width={233} height={370} sizes="233px" />
    </>}
  </>;
}

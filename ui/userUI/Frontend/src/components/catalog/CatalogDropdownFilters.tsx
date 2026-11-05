"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useCatalogDraft, type CatalogController } from "@/lib/catalog/useCatalog";
import { priceFilterError } from "@/lib/catalog/filters";
import { queryFor } from "@/lib/catalog/client";
import { emptyFilters, type CatalogFilters } from "./catalogData";
import { PriceStockFilters } from "./PriceStockFilters";
import fields from "./SearchFilters.module.css";
import styles from "./CatalogDropdownFilters.module.css";

function Dropdown({ label, count = 0, open, onToggle, children }: { label: string; count?: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [left, setLeft] = useState(0);
  return <div className={styles.dropdown}>
    <button ref={trigger} type="button" className={styles.trigger} aria-expanded={open} aria-controls={id} onClick={() => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setLeft(Math.max(16 - rect.left, Math.min(0, innerWidth - 16 - rect.left - Math.min(360, innerWidth - 32))));
      onToggle();
    }}><span>{label}</span>{count > 0 && <b>{count}</b>}<span className={styles.chevron} aria-hidden="true" /></button>
    {open && <div id={id} className={styles.popup} style={{ left }} role="region" aria-label={`Lọc ${label}`}>
      <div className={styles.options}>{children}</div>
    </div>}
  </div>;
}

export function CatalogDropdownFilters({ catalog }: { catalog: CatalogController }) {
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useCatalogDraft(catalog);
  const root = useRef<HTMLDivElement>(null);
  const { filters } = catalog.request;
  const { metadata, facets } = catalog;
  useEffect(() => {
    function dismiss(event: Event) { if (!root.current?.contains(event.target as Node)) setOpen(null); }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      (root.current?.querySelector('button[aria-expanded="true"]') as HTMLButtonElement | null)?.focus();
      setOpen(null);
    }
    const resized = () => setOpen(null);
    document.addEventListener("pointerdown", dismiss); document.addEventListener("focusin", dismiss); document.addEventListener("keydown", escape);
    window.addEventListener("resize", resized);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("focusin", dismiss); document.removeEventListener("keydown", escape); window.removeEventListener("resize", resized); };
  }, []);
  function toggle(key: string) { setOpen(current => current === key ? null : key); }
  function choose(next: CatalogFilters) {
    setDraft(next);
    (root.current?.querySelector('button[aria-expanded="true"]') as HTMLButtonElement | null)?.focus();
    setOpen(null);
  }
  function apply() { if (!priceFilterError(draft)) { catalog.apply(draft); setOpen(null); } }
  const dirty = queryFor({ ...catalog.request, filters: draft, page: 1 }).toString() !== queryFor({ ...catalog.request, page: 1 }).toString();
  const typeChanged = JSON.stringify([draft.categories, draft.subcategories]) !== JSON.stringify([filters.categories, filters.subcategories]);
  const priceError = priceFilterError(draft);
  const parent = draft.categories[0] ?? metadata.data.categories.find(category => category.children.some(child => child.id === draft.subcategories[0]))?.id ?? "";
  const children = metadata.data.categories.filter(category => !parent || category.id === parent).flatMap(category => category.children);
  const dropdown = (key: string, label: string, count: number, content: ReactNode) => <Dropdown key={key} label={label} count={count} open={open === key} onToggle={() => toggle(key)}>{content}</Dropdown>;
  const typeScoped = draft.categories.length > 0 || draft.subcategories.length > 0;
  const clear = () => { setDraft({ ...emptyFilters, categories: draft.categories, subcategories: draft.subcategories }); setOpen(null); };
  const stock = draft.stockStatus || (draft.inStock ? "in-stock" : "");
  const refinements = !!(draft.brand || draft.minPrice || draft.maxPrice || stock || Object.values(draft.specs ?? {}).some(values => values.length));
  return <div ref={root} className={styles.root} aria-label="Bộ lọc sản phẩm theo loại">
    <div className={styles.bar}>
    <div className={styles.row}>
      {dropdown("price", "Mức giá", Number(!!(draft.minPrice || draft.maxPrice)), <PriceStockFilters value={draft} onChange={setDraft} section="price" />)}
      {dropdown("type", "Loại sản phẩm", Number(typeScoped), <div className={styles.typeFields}>
        <label className={fields.field}>Nhóm sản phẩm<select value={parent} onChange={event => choose({ ...draft, categories: event.target.value ? [event.target.value] : [], subcategories: [], brand: "", specs: {} })}>
          <option value="">Tất cả nhóm sản phẩm</option>{metadata.data.categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select></label>
        <label className={fields.field}>Loại sản phẩm<select value={draft.subcategories[0] ?? ""} onChange={event => choose({ ...draft, categories: parent ? [parent] : [], subcategories: event.target.value ? [event.target.value] : [], brand: "", specs: {} })}>
          <option value="">Tất cả loại trong nhóm</option>{children.map(child => <option key={child.id} value={child.id}>{child.label}</option>)}
        </select></label>
        {metadata.loading && <p role="status">Đang tải loại sản phẩm…</p>}
        {metadata.error && <p role="alert">{metadata.error}<button type="button" onClick={metadata.retry}>Thử lại</button></p>}
      </div>)}
      {dropdown("brand", "Thương hiệu", Number(!!draft.brand), <>
        {facets.loading && <p role="status">Đang tải thương hiệu…</p>}
        {typeChanged && <p className={styles.hint}>Áp dụng loại sản phẩm mới để tải thương hiệu phù hợp.</p>}
        {!typeChanged && facets.data?.brands.map(option => <label key={option.value} className={styles.option}>
          <input type="radio" name="catalog-brand" checked={draft.brand === option.value} disabled={!dirty && !option.count && draft.brand !== option.value} onChange={() => choose({ ...draft, brand: option.value })} />
          <span>{option.label}</span>{!dirty && <small>{option.count}</small>}
        </label>)}
        <label className={styles.option}><input type="radio" name="catalog-brand" checked={!draft.brand} onChange={() => choose({ ...draft, brand: "" })} /><span>Tất cả thương hiệu</span></label>
      </>)}
      {dropdown("stock", "Tình trạng hàng", Number(!!stock), <PriceStockFilters value={draft} onChange={choose} section="stock" />)}
      {typeScoped && !typeChanged && facets.data?.specs.map(facet => dropdown(`spec:${facet.key}`, facet.label, draft.specs?.[facet.key]?.length ?? 0, <>
        {facet.options.map(option => {
          const selected = draft.specs?.[facet.key]?.includes(option.value) ?? false;
          return <label key={option.value} className={styles.option}>
            <input type="checkbox" checked={selected} disabled={!dirty && !selected && !option.count} onChange={() => choose({ ...draft, specs: { ...draft.specs, [facet.key]: selected ? draft.specs![facet.key].filter(value => value !== option.value) : [...(draft.specs?.[facet.key] ?? []), option.value] } })} />
            <span>{option.label}</span>{!dirty && <small>{option.count}</small>}
          </label>;
        })}
        <button type="button" className={styles.clear} onClick={() => choose({ ...draft, specs: { ...draft.specs, [facet.key]: [] } })}>Bỏ chọn {facet.label}</button>
      </>))}
      {refinements && <button type="button" className={styles.clear} onClick={clear}>Xóa điều kiện lọc</button>}
    </div>
    <button type="button" className={styles.applyButton} aria-label="Áp dụng bộ lọc" disabled={!dirty || !!priceError} onClick={apply}>Áp dụng</button>
    </div>
    {dirty && <p className={styles.hint} role="status">Bạn có thay đổi chưa áp dụng. Chọn thêm điều kiện rồi bấm Áp dụng để xem kết quả.</p>}
    {typeChanged && <p className={styles.hint}>Bộ lọc thông số sẽ cập nhật theo loại sản phẩm sau khi áp dụng.</p>}
    {priceError && open !== "price" && <p className={styles.error} role="alert">{priceError}</p>}
    {facets.loading && typeScoped && <p className={styles.hint} role="status">Đang tải thông số phù hợp với loại sản phẩm…</p>}
    {facets.error && <p className={styles.error} role="alert">{facets.error} <button type="button" onClick={facets.retry}>Thử lại bộ lọc thông số</button></p>}
  </div>;
}

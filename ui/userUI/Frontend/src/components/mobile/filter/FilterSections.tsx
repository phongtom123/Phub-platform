import { ColorSwatch } from "@/components/common/ColorSwatch";
import { FilterOption } from "@/components/common/FilterOption";
import type { CatalogFilters } from "@/components/catalog/catalogData";
import { filterBrandOptions, filterCategoryOptions, filterPriceOptions, filterSections, type FilterSectionId } from "./filterData";
import styles from "./MobileFilter.module.css";

interface Props {
  expanded: ReadonlySet<FilterSectionId>;
  draft: CatalogFilters;
  onToggle: (id: FilterSectionId) => void;
  onChange: (filters: CatalogFilters) => void;
}

export function FilterSections({ expanded, draft, onToggle, onChange }: Props) {
  return <div className={styles.sections}>
    {filterSections.map(section => <section key={section.id} className={styles.section}>
      <h3>
        <button type="button" className={styles.sectionButton} aria-expanded={expanded.has(section.id)} aria-controls={`mobile-filter-${section.id}`} onClick={() => onToggle(section.id)}>
          <span>{section.label}</span><span className={styles.chevron} aria-hidden="true" />
        </button>
      </h3>
      <div id={`mobile-filter-${section.id}`} className={styles.options} hidden={!expanded.has(section.id)}>
        {section.id === "category" && filterCategoryOptions.map(option => <FilterOption key={option.id} className={styles.option} label={option.label} count={option.count} selected={draft.categories.includes(option.id)} onClick={() => onChange({ ...draft, categories: draft.categories.includes(option.id) ? draft.categories.filter(id => id !== option.id) : [...draft.categories, option.id] })} />)}
        {section.id === "price" && filterPriceOptions.map(option => <FilterOption key={option.id} className={styles.option} label={option.label} count={option.count} selected={draft.price === option.id} onClick={() => onChange({ ...draft, price: draft.price === option.id ? "" : option.id })} />)}
        {section.id === "color" && <div className={styles.colors} role="radiogroup" aria-label="Màu sản phẩm">
          <ColorSwatch name="mobile-filter-color" label="Đen" color="#000" checked={draft.color === "black"} onChange={() => onChange({ ...draft, color: "black" })} />
          <ColorSwatch name="mobile-filter-color" label="Đỏ" color="#f00" checked={draft.color === "red"} onChange={() => onChange({ ...draft, color: "red" })} />
        </div>}
        {section.id === "brands" && filterBrandOptions.map(option => <FilterOption key={option.id} className={styles.option} label={option.label} count={option.count} selected={draft.brand === option.id} onClick={() => onChange({ ...draft, brand: draft.brand === option.id ? "" : option.id })} />)}
      </div>
    </section>)}
  </div>;
}

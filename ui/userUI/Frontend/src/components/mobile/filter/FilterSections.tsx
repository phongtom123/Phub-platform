import { FilterOption } from "@/components/common/FilterOption";
import type { CatalogFilters } from "@/components/catalog/catalogData";
import type { CatalogController } from "@/lib/catalog/useCatalog";
import { filterSections, type FilterSectionId } from "./filterData";
import styles from "./MobileFilter.module.css";
import { CatalogFilterFields } from "@/components/catalog/CatalogFilterFields";

interface Props {
  expanded: ReadonlySet<FilterSectionId>; draft: CatalogFilters;
  onToggle: (id: FilterSectionId) => void; onChange: (filters: CatalogFilters) => void;
  metadata: CatalogController["metadata"];
}
export function FilterSections({ expanded, draft, onToggle, onChange, metadata }: Props) {
  return <div className={styles.sections}>
    {filterSections.map(section => <section key={section.id} className={styles.section}>
      <h3><button type="button" className={styles.sectionButton} aria-expanded={expanded.has(section.id)} aria-controls={"mobile-filter-" + section.id} onClick={() => onToggle(section.id)}>
        <span>{section.label}</span><span className={styles.chevron} aria-hidden="true" />
      </button></h3>
      <div id={"mobile-filter-" + section.id} className={styles.options} hidden={!expanded.has(section.id)}>
        {section.id === "category" && metadata.data.categories.map(option => <FilterOption key={option.id} className={styles.option} label={option.label} selected={draft.categories.includes(option.id)} onClick={() => onChange({ ...draft, categories: draft.categories.includes(option.id) ? draft.categories.filter(id => id !== option.id) : [...draft.categories, option.id] })} />)}
        {section.id === "brands" && metadata.data.brands.map(option => <FilterOption key={option.id} className={styles.option} label={option.name} selected={draft.brand === option.id} onClick={() => onChange({ ...draft, brand: draft.brand === option.id ? "" : option.id })} />)}
        {["price", "color", "filterName"].includes(section.id) && <CatalogFilterFields section={section.id === "filterName" ? "stock" : section.id as "price" | "color"} draft={draft} onChange={onChange} colors={metadata.data.colors}/>}
      </div>
    </section>)}
  </div>;
}

import { Button } from "@/components/common/Button";
import type { CatalogFilters } from "@/components/catalog/catalogData";
import { filterCount } from "@/components/catalog/catalogData";
import { FilterSections } from "./FilterSections";
import type { FilterSectionId } from "./filterData";
import styles from "./MobileFilter.module.css";

interface Props {
  draft: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onExpand: (id: FilterSectionId) => void;
  onApply: () => void;
}

export function Filter1({ draft, onChange, onExpand, onApply }: Props) {
  return <>
    <FilterSections expanded={new Set<FilterSectionId>()} draft={draft} onChange={onChange} onToggle={onExpand} />
    <Button className={styles.apply} onClick={onApply}>Áp dụng bộ lọc ({filterCount(draft)})</Button>
  </>;
}

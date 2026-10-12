import { Button } from "@/components/common/Button";
import type { CatalogFilters } from "@/components/catalog/catalogData";
import { filterCount } from "@/components/catalog/catalogData";
import { FilterSections } from "./FilterSections";
import type { FilterSectionId } from "./filterData";
import styles from "./MobileFilter.module.css";
import type { CatalogController } from "@/lib/catalog/useCatalog";

interface Props {
  draft: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onExpand: (id: FilterSectionId) => void;
  onApply: () => void;
  metadata: CatalogController["metadata"];
}

export function Filter1({ draft, onChange, onExpand, onApply, metadata }: Props) {
  return <>
    <FilterSections expanded={new Set<FilterSectionId>()} draft={draft} onChange={onChange} onToggle={onExpand} metadata={metadata} />
    <Button className={styles.apply} onClick={onApply}>Áp dụng bộ lọc ({filterCount(draft)})</Button>
  </>;
}

import { Button } from "@/components/common/Button";
import type { CatalogFilters } from "@/components/catalog/catalogData";
import { filterCount } from "@/components/catalog/catalogData";
import { FilterSections } from "./FilterSections";
import type { FilterSectionId } from "./filterData";
import styles from "./MobileFilter.module.css";
import type { CatalogController } from "@/lib/catalog/useCatalog";

interface Props {
  expanded: ReadonlySet<FilterSectionId>;
  draft: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onToggle: (id: FilterSectionId) => void;
  onBack: () => void;
  metadata: CatalogController["metadata"];
}

export function Filter2({ expanded, draft, onChange, onToggle, onBack, metadata }: Props) {
  return <>
    <FilterSections expanded={expanded} draft={draft} onChange={onChange} onToggle={onToggle} metadata={metadata} />
    <Button className={styles.apply} onClick={onBack}>Áp dụng bộ lọc ({filterCount(draft)})</Button>
  </>;
}

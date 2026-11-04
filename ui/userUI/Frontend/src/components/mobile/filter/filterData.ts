export type FilterSectionId = "category" | "price" | "color" | "filterName" | "brands";

export const filterSections: { id: FilterSectionId; label: string }[] = [
  { id: "category", label: "Danh mục" },
  { id: "price", label: "Giá" },
  { id: "filterName", label: "Tình trạng tồn kho" },
  { id: "brands", label: "Thương hiệu" },
];

export const filter2ExpandedSections: FilterSectionId[] = ["category", "price", "color", "brands"];

export const filterCategoryOptions = [] as { id: string; label: string; count?: number }[];

export const filterPriceOptions = [] as { id: string; label: string; min: number; max: number; count?: number }[];

export const filterBrandOptions = [] as { id: string; label: string; count?: number }[];

import { categoryOptions, priceOptions } from "@/components/catalog/catalogData";

export type FilterSectionId = "category" | "price" | "color" | "filterName" | "brands";

export const filterSections: { id: FilterSectionId; label: string }[] = [
  { id: "category", label: "Danh mục" },
  { id: "price", label: "Giá" },
  { id: "color", label: "Màu sắc" },
  { id: "filterName", label: "Tên bộ lọc" },
  { id: "brands", label: "Thương hiệu" },
];

export const filter2ExpandedSections: FilterSectionId[] = ["category", "price", "color", "brands"];

const categoryLabels: Record<string, string> = {
  custom: "PC lắp ráp",
  "all-in-one": "PC All-in-One MSI",
  hp: "PC HP/Compaq",
};

export const filterCategoryOptions = [] as { id: string; label: string; count?: number }[];

export const filterPriceOptions = [] as { id: string; label: string; min: number; max: number; count?: number }[];

export const filterBrandOptions = [] as { id: string; label: string; count?: number }[];

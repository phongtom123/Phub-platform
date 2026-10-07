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

export const filterCategoryOptions = categoryOptions.map((option, index) => ({
  id: option.id,
  label: categoryLabels[option.id] ?? option.label,
  count: [15, 45, 1][index],
}));

export const filterPriceOptions = priceOptions.map((option, index) => ({
  ...option,
  label: index === priceOptions.length - 1 ? "$7,000.00 trở lên" : option.label.replace(" - ", " – "),
  count: [19, 21, 9, 6, 3, 1, 1, 1][index],
}));

export const filterBrandOptions = [
  { id: "adata", label: "ADATA", count: 19 },
  { id: "hp", label: "HP", count: 21 },
  { id: "tp-link", label: "TP-Link", count: 9 },
  { id: "asus", label: "ASUS", count: 6 },
  { id: "toshiba", label: "Toshiba", count: 3 },
  { id: "canon", label: "CANON", count: 1 },
  { id: "lg", label: "LG", count: 1 },
  { id: "msi", label: "MSI", count: 1 },
];

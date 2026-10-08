import type { CatalogProduct } from "@/components/catalog/catalogData";

// The mobile artwork is exported from Figma's Home Page 2 product tiles.


export const homePage2Products: CatalogProduct[] = [];

export const homePage2SortOptions = [
  { value: "position", label: "Vị trí" },
  { value: "price-asc", label: "Giá: Thấp đến cao" },
  { value: "price-desc", label: "Giá: Cao đến thấp" },
  { value: "name", label: "Tên sản phẩm" },
];

export const homePage2Description = [] as string[];

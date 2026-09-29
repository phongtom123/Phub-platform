// UI fixtures only. Names, prices, counts and configurations are illustrative.
export interface MenuCategory {
  id: string;
  label: string;
  count?: number;
  children?: readonly MenuCategory[];
}

const workstationSeries: readonly MenuCategory[] = [
  { id: "ws", label: "MSI WS Series", count: 12 },
  { id: "wt", label: "MSI WT Series", count: 3 },
  { id: "we", label: "MSI WE Series", count: 7 },
];

export const laptopMenuCategories: readonly MenuCategory[] = [
  { id: "everyday", label: "Everyday Use Notebooks", children: [
    { id: "workstation", label: "MSI Workstation Series", children: workstationSeries },
    { id: "prestige", label: "MSI Prestige Series", children: [
      { id: "prestige-14", label: "Prestige 14", count: 6 },
      { id: "prestige-16", label: "Prestige 16", count: 4 },
    ] },
  ] },
  { id: "workstation", label: "MSI Workstation Series", children: workstationSeries },
  { id: "prestige", label: "MSI Prestige Series" },
  { id: "gaming", label: "Gaming Notebooks" },
  { id: "tablets", label: "Tablets And Pads" },
  { id: "netbooks", label: "Netbooks" },
  { id: "infinity", label: "Infinity Gaming Notebooks" },
];

// Reuse the available product image for four demo configurations.
export const megaMenuProducts = [
  { id: "demo-01", name: "MSI Pro 16 Flex — Core i5 / RAM 8GB / SSD 256GB", amount: 12490000, originalAmount: 13990000, rating: 4, reviewCount: 4 },
  { id: "demo-02", name: "MSI Pro 16 Flex — Core i5 / RAM 16GB / SSD 512GB", amount: 14990000, originalAmount: 16490000, rating: 4.5, reviewCount: 12 },
  { id: "demo-03", name: "MSI Pro 16 Flex — Core i7 / RAM 16GB / SSD 512GB", amount: 18490000, originalAmount: 19990000, rating: 4, reviewCount: 8 },
  { id: "demo-04", name: "MSI Pro 16 Flex — Core i7 / RAM 32GB / SSD 1TB", amount: 21990000, originalAmount: 23990000, rating: 5, reviewCount: 6 },
] as const;

export const megaMenuBrands = [
  { id: "roccat", name: "ROCCAT" },
  { id: "msi", name: "MSI" },
  { id: "razer", name: "RAZER" },
  { id: "thermaltake", name: "Thermaltake" },
  { id: "adata", name: "ADATA" },
  { id: "hp", name: "Hewlett Packard" },
  { id: "gigabyte", name: "GIGABYTE" },
] as const;

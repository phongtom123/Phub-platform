export type StoreCategory = {
  id: string;
  name: string;
  description: string;
  visual: string;
  accent: string;
};

export type StoreProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  categoryId: string;
  visual: string;
  visualDetail: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  badge?: string;
  accent: string;
};

export const storeCategories: StoreCategory[] = [
  { id: "laptop", name: "Laptop", description: "Học tập, văn phòng và gaming", visual: "LAPTOP", accent: "#2563eb" },
  { id: "pc", name: "PC nguyên bộ", description: "Cấu hình tối ưu, lắp ráp sẵn", visual: "PC", accent: "#111827" },
  { id: "component", name: "Linh kiện PC", description: "CPU, VGA, RAM, mainboard", visual: "VGA", accent: "#7c3aed" },
  { id: "monitor", name: "Màn hình", description: "Gaming, đồ họa và văn phòng", visual: "240HZ", accent: "#0891b2" },
  { id: "storage", name: "Lưu trữ", description: "SSD và HDD chính hãng", visual: "SSD", accent: "#059669" },
  { id: "accessory", name: "Phụ kiện", description: "Bàn phím, chuột và tai nghe", visual: "GEAR", accent: "#ea580c" },
];

export const storeProducts: StoreProduct[] = [
  {
    id: "pc-phub-starter-r5",
    name: "PC PHUB Starter Ryzen 5 5600G / 16GB / SSD 500GB",
    brand: "PHUB",
    category: "PC nguyên bộ",
    categoryId: "pc",
    visual: "R5",
    visualDetail: "STARTER PC",
    price: 10490000,
    originalPrice: 11990000,
    rating: 4.8,
    reviews: 36,
    badge: "Bán chạy",
    accent: "#2563eb",
  },
  {
    id: "msi-modern-15",
    name: "Laptop MSI Modern 15 B13M i5 / 16GB / SSD 512GB",
    brand: "MSI",
    category: "Laptop",
    categoryId: "laptop",
    visual: "MSI",
    visualDetail: "MODERN 15",
    price: 14990000,
    originalPrice: 16990000,
    rating: 4.9,
    reviews: 52,
    badge: "-12%",
    accent: "#dc2626",
  },
  {
    id: "gigabyte-rtx-4060",
    name: "Gigabyte GeForce RTX 4060 WINDFORCE OC 8GB",
    brand: "GIGABYTE",
    category: "Card đồ họa",
    categoryId: "component",
    visual: "RTX",
    visualDetail: "4060 OC",
    price: 8290000,
    originalPrice: 8990000,
    rating: 4.7,
    reviews: 28,
    badge: "Giá tốt",
    accent: "#16a34a",
  },
  {
    id: "aoc-27g4",
    name: "Màn hình Gaming AOC 27G4 27 inch FHD 180Hz",
    brand: "AOC",
    category: "Màn hình",
    categoryId: "monitor",
    visual: "180",
    visualDetail: "HZ / IPS",
    price: 4290000,
    rating: 4.8,
    reviews: 41,
    badge: "Mới",
    accent: "#7c3aed",
  },
  {
    id: "samsung-990-evo",
    name: "SSD Samsung 990 EVO Plus 1TB NVMe PCIe 4.0",
    brand: "SAMSUNG",
    category: "Ổ cứng SSD",
    categoryId: "storage",
    visual: "1TB",
    visualDetail: "NVME GEN4",
    price: 2390000,
    originalPrice: 2690000,
    rating: 4.9,
    reviews: 74,
    badge: "Top rated",
    accent: "#0284c7",
  },
  {
    id: "corsair-vengeance-ddr5",
    name: "RAM Corsair Vengeance RGB 32GB DDR5 6000MHz",
    brand: "CORSAIR",
    category: "RAM",
    categoryId: "component",
    visual: "32GB",
    visualDetail: "DDR5 RGB",
    price: 3190000,
    rating: 4.6,
    reviews: 19,
    accent: "#db2777",
  },
  {
    id: "cooler-master-750w",
    name: "Nguồn Cooler Master MWE Gold 750 V2 Full Modular",
    brand: "COOLER MASTER",
    category: "Nguồn máy tính",
    categoryId: "component",
    visual: "750W",
    visualDetail: "80+ GOLD",
    price: 2490000,
    originalPrice: 2790000,
    rating: 4.7,
    reviews: 23,
    accent: "#d97706",
  },
  {
    id: "razer-blackwidow-v4",
    name: "Bàn phím cơ Razer BlackWidow V4 X Green Switch",
    brand: "RAZER",
    category: "Phụ kiện",
    categoryId: "accessory",
    visual: "V4 X",
    visualDetail: "GREEN SWITCH",
    price: 3290000,
    rating: 4.8,
    reviews: 31,
    badge: "Quà tặng",
    accent: "#65a30d",
  },
];

export const brandLogos = [
  { name: "MSI", src: "/images/brands/msi.png" },
  { name: "Gigabyte", src: "/images/brands/gigabyte.png" },
  { name: "HP", src: "/images/brands/hp.png" },
  { name: "ADATA", src: "/images/brands/adata.png" },
  { name: "Razer", src: "/images/brands/razer.png" },
  { name: "Thermaltake", src: "/images/brands/thermaltake.png" },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

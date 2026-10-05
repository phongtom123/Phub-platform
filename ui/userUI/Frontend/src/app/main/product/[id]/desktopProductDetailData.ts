export type ProductDetailTab = "about" | "details" | "specs";

export const desktopProductDetailFacts = [
  "Intel Core i7-10700F", "Intel H410", "WHITE",
  "NVIDIA MSI GeForce RTX 2060 SUPER 8GB AERO ITX GDDR6",
  "SO-DIMM 16GB (16GB x 1) DDR4 2666MHz", "2 total slots (64GB Max)",
  "512GB M.2 NVMe PCIe GEN3x4 SSD, 2TB HDD", "Gaming Keyboard GK30 + Gaming Mouse GM11",
  "3.5 HDD (0/0), 2.5 HDD/SSD (1/0), M.2 (1/0)",
  "Intel WGI219V Ethernet (10/100/1000M)", "AX200 (WIFI 6) + BT5.1",
  "PSU 330W", "Fan Cooler",
];

export const desktopProductDetailTabs: { id: ProductDetailTab; label: string }[] = [
  { id: "about", label: "About Product" },
  { id: "details", label: "Details" },
  { id: "specs", label: "Specs" },
];

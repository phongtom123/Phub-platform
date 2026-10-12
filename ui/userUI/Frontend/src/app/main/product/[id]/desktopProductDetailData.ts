export type ProductDetailTab = "about" | "details" | "specs";

export const desktopProductDetailFacts = [] as string[];

export const desktopProductDetailTabs: { id: ProductDetailTab; label: string }[] = [
  { id: "about", label: "About Product" },
  { id: "details", label: "Details" },
  { id: "specs", label: "Specs" },
];

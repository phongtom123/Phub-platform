import type { StoreProduct } from "./storefront-data";
export interface DetailProduct extends Omit<StoreProduct, "rating" | "reviews"> {
  imageSrc?: string; mobileImageSrc?: string; currency: string; sku: string;
  stock?: "in-stock" | "check-availability"; rating?: number; reviews?: number;
  description?: string; warrantyMonths?: number; unit?: string; source?: "api";
  images?: { url: string; alt: string }[];
  specifications: { label: string; value: string }[];
}
// No fallback product collection. Detail routes load the actual catalog API.

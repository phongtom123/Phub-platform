import type { ProductCardProps } from "@/components/common/ProductCard";
export type HomeProduct = Pick<ProductCardProps, "name" | "imageSrc" | "amount" | "originalAmount" | "stock" | "rating" | "reviewCount" | "mobileImageSrc" | "currency" | "locale"> & { id: string };
export interface ProductGroup { label: string; products: HomeProduct[] }
export interface HomeCategory { id: string; title: string; image: string; mobileImage: string; groups: ProductGroup[] }
// Home products/categories/brands come exclusively from the catalog API.

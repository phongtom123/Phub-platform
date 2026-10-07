"use client";

import type { DetailProduct } from "@/data/product-details";
import { useMobile } from "@/lib/catalog/useCatalog";
import { DesktopProductDetail } from "./DesktopProductDetail";
import { ProductPage1 } from "@/components/mobile/product-page-1/ProductPage1";
import type { ProductDetailTab } from "./desktopProductDetailData";

export function ResponsiveProductDetail({ product, activeTab }: { product: DetailProduct; activeTab: ProductDetailTab }) {
  return useMobile() ? <ProductPage1 product={product} activeTab={activeTab} /> : <DesktopProductDetail product={product} activeTab={activeTab} />;
}

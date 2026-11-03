"use client";

import type { DetailProduct } from "@/data/product-details";
import { useMobile } from "@/lib/catalog/useCatalog";
import { DesktopProductDetail } from "./DesktopProductDetail";
import { ProductPage1 } from "@/components/mobile/product-page-1/ProductPage1";
import { useProductStock } from "@/lib/catalog/useProductStock";

export function ResponsiveProductDetail({ product }: { product: DetailProduct }) {
  const stock = useProductStock(product, true, true);
  return useMobile() ? <ProductPage1 product={product} stock={stock} /> : <DesktopProductDetail product={product} stock={stock} />;
}

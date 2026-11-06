"use client";

import type { DetailProduct } from "@/data/product-details";
import { useMobile } from "@/lib/catalog/useCatalog";
import { DesktopProductDetail } from "./DesktopProductDetail";
import { ProductPage1 } from "@/components/mobile/product-page-1/ProductPage1";
import { useProductStock } from "@/lib/catalog/useProductStock";
import { ProductReviews } from "@/components/engagement/ProductReviews";

export function ResponsiveProductDetail({ product }: { product: DetailProduct }) {
  const stock = useProductStock(product, true, true);
  const mobile = useMobile();
  return <>{mobile ? <ProductPage1 product={product} stock={stock} /> : <DesktopProductDetail product={product} stock={stock} />}<ProductReviews key={product.id} productId={product.id}/></>;
}

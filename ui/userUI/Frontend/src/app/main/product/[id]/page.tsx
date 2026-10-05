import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog/server";
import { detailProduct } from "@/lib/catalog/types";
import { CatalogApiError } from "@/lib/catalog/client";
import { ResponsiveProductDetail } from "./ResponsiveProductDetail";
import type { ProductDetailTab } from "./desktopProductDetailData";

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  let product;
  try { product = detailProduct(await getProduct(id)); }
  catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) notFound();
    throw new Error("Không thể tải thông tin sản phẩm.");
  }
  const selected = (await searchParams).tab;
  const activeTab: ProductDetailTab = selected === "details" || selected === "specs" ? selected : "about";

  return <ResponsiveProductDetail product={product} activeTab={activeTab} />;
}

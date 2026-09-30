import { notFound } from "next/navigation";
import { getDetailProduct } from "@/data/product-details";
import { DesktopProductDetail } from "./DesktopProductDetail";
import type { ProductDetailTab } from "./desktopProductDetailData";

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const product = getDetailProduct(id);
  if (!product) notFound();
  const selected = (await searchParams).tab;
  const activeTab: ProductDetailTab = selected === "details" || selected === "specs" ? selected : "about";

  return <DesktopProductDetail product={product} activeTab={activeTab} />;
}

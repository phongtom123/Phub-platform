import { notFound } from "next/navigation";
import { ProductPage1 } from "@/components/mobile/product-page-1/ProductPage1";
import { getDetailProduct } from "@/data/product-details";
import { DesktopProductDetail } from "./DesktopProductDetail";
import type { ProductDetailTab } from "./desktopProductDetailData";
import styles from "./detail.module.css";

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const product = getDetailProduct(id);
  if (!product) notFound();
  const selected = (await searchParams).tab;
  const activeTab: ProductDetailTab = selected === "details" || selected === "specs" ? selected : "about";

  return <>
    <div className={styles.desktopOnly}><DesktopProductDetail product={product} activeTab={activeTab} /></div>
    <ProductPage1 product={product} activeTab={activeTab} />
  </>;
}

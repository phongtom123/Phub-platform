import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog/server";
import { detailProduct } from "@/lib/catalog/types";
import { CatalogApiError } from "@/lib/catalog/client";
import { ResponsiveProductDetail } from "./ResponsiveProductDetail";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  try { product = detailProduct(await getProduct(id)); }
  catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) notFound();
    throw new Error("Không thể tải thông tin sản phẩm.");
  }
  return <ResponsiveProductDetail product={product} />;
}

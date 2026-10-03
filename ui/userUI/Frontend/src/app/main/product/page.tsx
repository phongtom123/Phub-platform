import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogExperience } from "@/components/catalog/CatalogExperience";

export const metadata: Metadata = {
  title: "Sản phẩm | Tech Store",
  description: "Tìm kiếm sản phẩm theo tên, SKU, loại sản phẩm và thương hiệu.",
};

export default function ProductsPage() {
  return <Suspense fallback={<p role="status">Đang tải danh sách sản phẩm…</p>}><CatalogExperience /></Suspense>;
}

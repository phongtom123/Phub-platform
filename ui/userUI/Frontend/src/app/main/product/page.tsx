import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/CatalogPage";

export const metadata: Metadata = {
  title: "MSI PS Series | Tech Store",
  description: "Khám phá các mẫu laptop MSI Prestige trong giao diện danh mục sản phẩm.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; menuCategory?: string | string[]; menuItem?: string | string[] }> }) {
  const { view } = await searchParams;
  return <CatalogPage initialView={view === "list" ? "list" : "grid"} />;
}

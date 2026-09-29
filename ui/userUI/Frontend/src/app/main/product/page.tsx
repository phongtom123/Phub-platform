import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/CatalogPage";

export const metadata: Metadata = {
  title: "MSI PS Series | Tech Store",
  description: "Browse the MSI Prestige collection. Catalog interface with sample products.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  return <CatalogPage initialView={view === "list" ? "list" : "grid"} />;
}

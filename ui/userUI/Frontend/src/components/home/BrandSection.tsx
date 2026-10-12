"use client";
import { useCatalogMetadata } from "@/lib/catalog/useCatalog";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import Link from "next/link";
export function BrandSection() {
  const metadata = useCatalogMetadata();
  if (metadata.loading || metadata.error) return <CatalogStatus loading={metadata.loading} error={metadata.error} retry={metadata.retry} />;
  if (!metadata.data.brands.length) return null;
  return <section aria-label="Thương hiệu sản phẩm"><h2>Thương hiệu</h2><div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "16px 0" }}>
    {metadata.data.brands.map(brand => <Link key={brand.id} href={`/main/product?brand=${encodeURIComponent(brand.id)}`}>{brand.name}</Link>)}
  </div></section>;
}

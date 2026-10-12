"use client";
import Link from "next/link";
import { useCatalogMetadata } from "@/lib/catalog/useCatalog";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import styles from "./MegaMenu.module.css";
export function MegaMenu({ onClose }: { onClose: () => void }) {
  const metadata = useCatalogMetadata();
  return <section className={styles.menu} aria-label="Danh mục sản phẩm">
    <div className={styles.toolbar}><h2>Loại sản phẩm</h2><button onClick={onClose} aria-label="Đóng menu">×</button></div>
    {metadata.loading || metadata.error ? <CatalogStatus loading={metadata.loading} error={metadata.error} retry={metadata.retry} /> :
      <nav>{metadata.data.categories.map(category => <p key={category.id}><Link href={`/main/product?category_id=${encodeURIComponent(category.id)}`} onClick={onClose}>{category.label}</Link></p>)}</nav>}
    <Link href="/main/product" onClick={onClose}>Tất cả sản phẩm</Link>
  </section>;
}

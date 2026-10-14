"use client";
import Link from "next/link";
import { categoryHref, childCategories } from "@/lib/catalog/categories";
import type { CatalogCategory } from "@/lib/catalog/types";
import styles from "./MegaMenu.module.css";
export function MegaMenu({ categories, category, onClose }: {
  categories: CatalogCategory[]; category: CatalogCategory; onClose: () => void;
}) {
  function children(parentId: string, ancestors: string[]) {
    const items = childCategories(categories, parentId).filter(item => !ancestors.includes(item.id));
    return items.length > 0 ? <ul>{items.map(item => <li key={item.id}>
      <Link href={categoryHref(item.id)} onClick={onClose}>{item.label}</Link>
      {children(item.id, [...ancestors, item.id])}
    </li>)}</ul> : null;
  }
  return <section className={styles.menu} aria-label={`Danh mục ${category.label}`}>
    <div className={styles.toolbar}><h2>{category.label}</h2><button onClick={onClose} aria-label="Đóng menu">×</button></div>
    <nav className={styles.categoryTree} aria-label={`Danh mục con của ${category.label}`}>
      <Link href={categoryHref(category.id)} onClick={onClose}>Xem tất cả {category.label}</Link>
      {children(category.id, [category.id])}
    </nav>
  </section>;
}

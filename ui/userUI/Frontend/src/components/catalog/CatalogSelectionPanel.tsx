import Link from "next/link";
import { productHref } from "@/lib/catalog/types";
import type { CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

interface Props { title: string; emptyText: string; products: CatalogProduct[]; onRemove: (product: CatalogProduct) => void; locale?: "en" | "vi" }
export function CatalogSelectionPanel({ title, emptyText, products, onRemove, locale = "en" }: Props) {
  return <section className={`${styles.emptyPanel} ${products.length ? styles.savedPanel : ""}`} aria-label={title}>
    <h2>{title}{products.length > 0 && ` (${products.length})`}</h2>
    {products.length ? <>
      <ul className={styles.savedItems}>{products.map(product => <li key={product.id}><Link href={productHref(product.id)}>{product.name}</Link><button aria-label={locale === "vi" ? `Xóa ${product.name} khỏi ${title}` : `Remove ${product.name} from ${title}`} onClick={() => onRemove(product)}>×</button></li>)}</ul>
      <small>{locale === "vi" ? "Chỉ được lưu trong bản xem thử giao diện." : "Saved for this UI preview only."}</small>
    </> : <p>{emptyText}</p>}
  </section>;
}

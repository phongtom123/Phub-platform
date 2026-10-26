import type { CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

interface Props { title: string; emptyText: string; products: CatalogProduct[]; onRemove: (product: CatalogProduct) => void; onSelect: (product: CatalogProduct) => void; locale?: "en" | "vi" }
export function CatalogSelectionPanel({ title, emptyText, products, onRemove, onSelect, locale = "en" }: Props) {
  return <section className={`${styles.emptyPanel} ${products.length ? styles.savedPanel : ""}`} aria-label={title}>
    <h2>{title}{products.length > 0 && ` (${products.length})`}</h2>
    {products.length ? <>
      <ul className={styles.savedItems}>{products.map(product => <li key={product.id}><button onClick={() => onSelect(product)}>{product.name}</button><button aria-label={locale === "vi" ? `Xóa ${product.name} khỏi ${title}` : `Remove ${product.name} from ${title}`} onClick={() => onRemove(product)}>×</button></li>)}</ul>
      <small>{locale === "vi" ? "Chỉ được lưu trong bản xem thử giao diện." : "Saved for this UI preview only."}</small>
    </> : <p>{emptyText}</p>}
  </section>;
}

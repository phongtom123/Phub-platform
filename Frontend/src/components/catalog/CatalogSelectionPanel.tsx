import type { CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

interface Props { title: string; emptyText: string; products: CatalogProduct[]; onRemove: (product: CatalogProduct) => void; onSelect: (product: CatalogProduct) => void }
export function CatalogSelectionPanel({ title, emptyText, products, onRemove, onSelect }: Props) {
  return <section className={`${styles.emptyPanel} ${products.length ? styles.savedPanel : ""}`} aria-label={title}>
    <h2>{title}{products.length > 0 && ` (${products.length})`}</h2>
    {products.length ? <>
      <ul className={styles.savedItems}>{products.map(product => <li key={product.id}><button onClick={() => onSelect(product)}>{product.name}</button><button aria-label={`Remove ${product.name} from ${title}`} onClick={() => onRemove(product)}>×</button></li>)}</ul>
      <small>Saved for this UI preview only.</small>
    </> : <p>{emptyText}</p>}
  </section>;
}

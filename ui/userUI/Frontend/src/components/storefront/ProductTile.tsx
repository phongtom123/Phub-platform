import Link from "next/link";
import type { CSSProperties } from "react";
import { formatCurrency, type StoreProduct } from "@/data/storefront-data";
import styles from "./ProductTile.module.css";

export function ProductTile({ product }: { product: StoreProduct }) {
  const visualStyle = { "--product-accent": product.accent } as CSSProperties;

  return (
    <article className={styles.card}>
      <Link href={`/main/product/${product.id}`} className={styles.link}>
        <div className={styles.visual} style={visualStyle}>
          {product.badge && <span className={styles.badge}>{product.badge}</span>}
          <span className={styles.brand}>{product.brand}</span>
          <strong>{product.visual}</strong>
          <small>{product.visualDetail}</small>
        </div>
        <div className={styles.content}>
          <p className={styles.category}>{product.category}</p>
          <h3>{product.name}</h3>
          <div className={styles.rating} aria-label={`${product.rating} trên 5 sao`}>
            <span aria-hidden="true">★★★★★</span>
            <small>{product.rating} ({product.reviews})</small>
          </div>
          <div className={styles.priceRow}>
            <div>
              {product.originalPrice && <del>{formatCurrency(product.originalPrice)}</del>}
              <strong>{formatCurrency(product.price)}</strong>
            </div>
            <span className={styles.arrow} aria-hidden="true">→</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

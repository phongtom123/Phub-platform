import Link from "next/link";
import type { DetailProduct } from "@/data/product-details";
import { ProductSummary } from "./ProductSummary";
import { ProductStockSummary } from "@/components/catalog/ProductStockSummary";
import type { ProductStock } from "@/lib/catalog/useProductStock";
import styles from "./ProductPage1.module.css";

export function ProductInfo({ product, stock }: { product: DetailProduct; stock: ProductStock }) {
  const contactHref = `/contact-us?${new URLSearchParams({ product_id: product.id, product_name: product.name })}`;

  return <section className={styles.info} aria-label="Thông tin sản phẩm">
    <h1>{product.name}</h1>
    <ProductSummary product={product} />
    <ProductStockSummary stock={stock} unit={product.unit} />
    <div className={styles.meta}>
      <p><strong>Cần tư vấn?</strong> <Link href={contactHref}>Liên hệ</Link></p>
    </div>
  </section>;
}

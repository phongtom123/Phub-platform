import { ProductDetailActions } from "@/app/main/product/[id]/ProductDetailActions";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  return (
    <section id="product-purchase" className={styles.purchase} aria-label="Mua sản phẩm">
      <ProductDetailActions product={product} />
    </section>
  );
}

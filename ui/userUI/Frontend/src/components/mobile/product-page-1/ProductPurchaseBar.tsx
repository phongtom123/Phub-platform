import { Price } from "@/components/common/Price";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  return (
    <section id="product-purchase" className={styles.purchase} aria-label="Mua sản phẩm">
      <div className={styles.purchaseControls}>
        <AddToCartButton
          className={styles.cartButton}
          product={{ id: product.id, sku: product.sku }}
          label="Thêm vào giỏ"
        />
      </div>
      <div className={styles.salePrice}>
        <span>Giá bán</span>
        <Price
          amount={product.price}
          currency={product.currency}
          locale={product.currency === "VND" ? "vi-VN" : "en-US"}
          uiLocale="vi"
        />
      </div>
    </section>
  );
}

import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";
export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  return <section id="product-purchase" className={styles.purchase} aria-label="Mua sản phẩm">
    <div className={styles.purchaseControls}><Button disabled>Thêm vào giỏ</Button></div>
    <p>Giỏ hàng và thanh toán chưa được kết nối API.</p>
    <div className={styles.salePrice}><span>Giá bán</span><Price amount={product.price} currency={product.currency} locale={product.currency === "VND" ? "vi-VN" : "en-US"} uiLocale="vi" /></div>
  </section>;
}

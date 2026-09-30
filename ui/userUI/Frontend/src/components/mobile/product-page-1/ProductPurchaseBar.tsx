import Image from "next/image";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { QuantityInput } from "@/components/common/QuantityInput";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  return <section id="product-purchase" className={styles.purchase} aria-label="Mua sản phẩm">
    <div className={styles.purchaseControls}>
      <QuantityInput defaultValue={1} min={1} label="Số lượng" className={styles.quantity} />
      <Button className={styles.cartButton}>Thêm vào giỏ</Button>
      <button type="button" className={styles.paypalButton} aria-label="Thanh toán qua PayPal">
        <Image src="/images/figma-mobile/product-page-1/paypal-button.png" width={129} height={38} alt="PayPal" />
      </button>
    </div>
    <div className={styles.salePrice}>
      <span>Giá ưu đãi từ</span>
      <Price amount={product.price} currency={product.currency} locale={product.currency === "VND" ? "vi-VN" : "en-US"} uiLocale="vi" />
    </div>
  </section>;
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { QuantityInput } from "@/components/common/QuantityInput";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  return <section id="product-purchase" className={styles.purchase} aria-label="Mua sản phẩm">
    <div className={styles.purchaseControls}>
      <QuantityInput value={quantity} onValueChange={setQuantity} min={1} label="Số lượng" className={styles.quantity} />
      <Button className={styles.cartButton} onClick={() => setNotice(`Đã chọn ${quantity} sản phẩm trong giỏ hàng mẫu. Chưa tạo đơn hàng.`)}>Thêm vào giỏ</Button>
      <button type="button" className={styles.paypalButton} aria-label="Thanh toán qua PayPal" onClick={() => setNotice("Thanh toán hiện chỉ là bản xem thử giao diện.")}>
        <Image src="/images/figma-mobile/product-page-1/paypal-button.png" width={129} height={38} alt="PayPal" />
      </button>
    </div>
    {notice && <p role="status" style={{ padding: "0 12px", fontSize: 12 }}>{notice}</p>}
    <div className={styles.salePrice}>
      <span>Giá bán</span>
      <Price amount={product.price} currency={product.currency} locale={product.currency === "VND" ? "vi-VN" : "en-US"} uiLocale="vi" />
    </div>
  </section>;
}

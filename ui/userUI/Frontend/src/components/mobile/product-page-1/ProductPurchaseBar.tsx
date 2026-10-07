"use client";
import { useState } from "react";
import { Price } from "@/components/common/Price";
import { QuantityInput } from "@/components/common/QuantityInput";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";
export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <section
      id="product-purchase"
      className={styles.purchase}
      aria-label="Mua sản phẩm"
    >
      <div className={styles.purchaseControls}>
        <QuantityInput
          value={quantity}
          onValueChange={setQuantity}
          min={1}
          max={1000}
          label="Số lượng"
          className={styles.quantity}
        />
        <AddToCartButton
          product={product}
          quantity={quantity}
          className={styles.cartButton}
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

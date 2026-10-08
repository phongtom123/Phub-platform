"use client";
import Link from "next/link";
import { useState } from "react";
import { TaxNotice } from "@/components/common/Price";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";
import type { DetailProduct } from "@/data/product-details";
import styles from "./detail.module.css";
export function ProductDetailActions({ product }: { product: DetailProduct }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <div className={styles.buyArea}>
      <p>
        Giá bán{" "}
        <strong>
          {new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: product.currency,
          }).format(product.price)}
        </strong>
        <TaxNotice />
      </p>
      <div className={styles.quantity} aria-label="Số lượng">
        <strong>{quantity}</strong>
        <span>
          <button
            type="button"
            aria-label="Tăng số lượng"
            disabled={quantity >= 1000}
            onClick={() => setQuantity((value) => value + 1)}
          >
            ⌃
          </button>
          <button
            type="button"
            aria-label="Giảm số lượng"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => value - 1)}
          >
            ⌄
          </button>
        </span>
      </div>
      <AddToCartButton
        product={product}
        quantity={quantity}
        className={styles.cartButton}
      />
      <Link href="/cart">Xem giỏ hàng</Link>
    </div>
  );
}

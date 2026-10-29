"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";
import type { DetailProduct } from "@/data/product-details";
import styles from "./detail.module.css";

export function ProductDetailActions({
  product,
  price,
  currency = "VND",
}: {
  product?: DetailProduct;
  price?: number;
  currency?: string;
}) {
  const router = useRouter();
  const shop = useShopping();
  const [quantity, setQuantity] = useState(1);

  const actualPrice = product?.price ?? price ?? 0;
  const actualCurrency = product?.currency ?? currency ?? "VND";
  const formattedPrice = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: actualCurrency,
  }).format(actualPrice);

  const handleBuyNow = async () => {
    if (!product) return;
    const added = await shop.add({ id: product.id, sku: product.sku }, quantity);
    if (added) router.push("/cart");
  };

  return (
    <div className={styles.buyArea}>
      <p>
        Giá bán <strong>{formattedPrice}</strong>
      </p>

      <div className={styles.quantityControls}>
        <span style={{ fontSize: 13, color: "#666" }}>Số lượng:</span>
        <button
          type="button"
          aria-label="Giảm số lượng"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          style={{
            width: 28,
            height: 28,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
          disabled={quantity <= 1}
        >
          -
        </button>
        <span
          style={{
            minWidth: 32,
            textAlign: "center",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Tăng số lượng"
          onClick={() => setQuantity((q) => Math.min(99, q + 1))}
          style={{
            width: 28,
            height: 28,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          +
        </button>
      </div>

      <div className={styles.purchaseActions}>
        {product ? (
          <AddToCartButton
            className={styles.cartButton}
            product={{ id: product.id, sku: product.sku }}
            quantity={quantity}
          />
        ) : (
          <button className={styles.cartButton} type="button" disabled>
            Sản phẩm chưa khả dụng
          </button>
        )}
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={shop.cartLoading || !product}
          className={styles.buyNowButton}
        >
          <span aria-hidden="true">⚡</span>
          <span>Mua ngay</span>
        </button>
      </div>
    </div>
  );
}

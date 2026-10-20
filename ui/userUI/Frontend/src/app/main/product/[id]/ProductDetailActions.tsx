"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShopping } from "@/components/shopping/ShoppingProvider";
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
  const [addedNotice, setAddedNotice] = useState(false);

  const actualPrice = product?.price ?? price ?? 0;
  const actualCurrency = product?.currency ?? currency ?? "VND";
  const formattedPrice = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: actualCurrency,
  }).format(actualPrice);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      await shop.add({ id: product.id, sku: product.sku }, quantity);
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 3000);
    } catch {
      // Handled by shop notice
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    try {
      await shop.add({ id: product.id, sku: product.sku }, quantity);
      router.push("/cart");
    } catch {
      router.push("/cart");
    }
  };

  return (
    <div className={styles.buyArea}>
      <p>
        Giá bán <strong>{formattedPrice}</strong>
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
        <span style={{ fontSize: 13, color: "#666" }}>Số lượng:</span>
        <button
          type="button"
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

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className={styles.cartButton}
          type="button"
          disabled={shop.cartLoading || !product}
          onClick={handleAddToCart}
        >
          {shop.cartLoading ? "Đang xử lý..." : "Thêm vào giỏ"}
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={shop.cartLoading || !product}
          style={{
            height: 44,
            padding: "0 20px",
            background: "#0156ff",
            color: "#fff",
            border: 0,
            borderRadius: 22,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Mua ngay
        </button>
      </div>

      {addedNotice && (
        <p style={{ color: "#187b34", fontSize: 13, margin: "6px 0 0", fontWeight: 500 }}>
          ✓ Đã thêm sản phẩm vào giỏ hàng!
        </p>
      )}
    </div>
  );
}

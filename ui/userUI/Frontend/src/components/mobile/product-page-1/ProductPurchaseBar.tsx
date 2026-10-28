"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductPurchaseBar({ product }: { product: DetailProduct }) {
  const shop = useShopping();
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    try {
      await shop.add({ id: product.id, sku: product.sku }, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch {
      // Handled by shop notice
    }
  };

  return (
    <section id="product-purchase" className={styles.purchase} aria-label="Mua sản phẩm">
      <div className={styles.purchaseControls}>
        <Button
          disabled={shop.cartLoading}
          onClick={handleAdd}
        >
          {shop.cartLoading ? "Đang xử lý..." : added ? "✓ Đã thêm" : "Thêm vào giỏ"}
        </Button>
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

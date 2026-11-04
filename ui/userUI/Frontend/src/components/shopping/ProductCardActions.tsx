"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProductStock } from "@/lib/catalog/useProductStock";
import { useShopping } from "./ShoppingProvider";
import { AddToCartButton } from "./AddToCartButton";
import styles from "./ProductCardActions.module.css";

/** Both actions share one stock check. Buying now only adds to cart and opens it. */
export function ProductCardActions({ product }: { product: { id: string; sku?: string; isActive?: boolean } }) {
  const stock = useProductStock(product);
  const shop = useShopping();
  const router = useRouter();
  const [buying, setBuying] = useState(false);
  const addingThisProduct = shop.addingProductIds.includes(product.id);
  if (stock.status === "sold_out" || stock.status === "inactive") return <span role="status"
    className={styles.unavailable}>{stock.status === "inactive" ? "Tạm ngừng bán" : "Hết hàng"}</span>;
  if (stock.status === "error") return <div className={styles.error}>
    <span role="alert">Không kiểm tra được tồn kho.</span>
    <button type="button" onClick={stock.reload}>Thử lại</button>
  </div>;

  async function buyNow() {
    if (buying || addingThisProduct || stock.status !== "available") return;
    setBuying(true);
    try {
      const added = await shop.add(product, 1);
      stock.reload();
      if (added) router.push("/cart");
    } finally { setBuying(false); }
  }

  return <div className={styles.actions} aria-busy={buying || addingThisProduct || stock.status === "checking"}>
    <AddToCartButton product={product} stock={stock} iconOnly className={styles.cart} disabled={buying} />
    <button type="button" className={styles.buy} onClick={() => void buyNow()}
      disabled={buying || addingThisProduct || stock.status !== "available" || shop.cartRestoring || shop.authStatus === "loading"}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M14 5c3-3 6-3 6-3s0 3-3 6l-6 6-4-4 7-5ZM7 10l-4 1 4 2m4 1-1 4-2-4M5 16l-2 5 5-2" />
      </svg>
      <span>{buying ? "Đang thêm…" : "Mua ngay"}</span>
    </button>
  </div>;
}

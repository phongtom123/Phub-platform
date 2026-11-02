"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";
import { useProductStock } from "@/lib/catalog/useProductStock";
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
  const stock = useProductStock(product);
  const [quantityText, setQuantityText] = useState("1");
  const quantity = Number(quantityText);
  const validQuantity = quantityText !== "" && Number.isSafeInteger(quantity) && quantity > 0;

  const actualPrice = product?.price ?? price ?? 0;
  const actualCurrency = product?.currency ?? currency ?? "VND";
  const formattedPrice = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: actualCurrency,
  }).format(actualPrice);

  const handleBuyNow = async () => {
    if (!product || !validQuantity || stock.status !== "available") return;
    const added = await shop.add({ id: product.id, sku: product.sku }, quantity);
    stock.reload();
    if (added) router.push("/cart");
  };

  return (
    <div className={styles.buyArea}>
      <p>
        Giá bán <strong>{formattedPrice}</strong>
      </p>

      {stock.status !== "sold_out" && <div className={styles.quantityControls}>
        <span style={{ fontSize: 13, color: "#666" }}>Số lượng:</span>
        <button
          type="button"
          aria-label="Giảm số lượng"
          onClick={() => setQuantityText(value => {
            const next = BigInt(value || "1") - BigInt(1);
            return next < BigInt(1) ? "1" : String(next);
          })}
          style={{
            width: 28,
            height: 28,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
          disabled={quantityText === "" || quantity <= 1}
        >
          -
        </button>
        <input
          className={styles.quantityInput}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Số lượng"
          aria-invalid={quantityText !== "" && !validQuantity}
          value={quantityText}
          onChange={event => {
            if (/^\d*$/.test(event.target.value)) setQuantityText(event.target.value);
          }}
          onBlur={() => {
            if (quantityText === "") setQuantityText("1");
            else if (validQuantity) setQuantityText(String(quantity));
          }}
          onKeyDown={event => {
            if (["-", "+", ".", ",", "e", "E"].includes(event.key)) event.preventDefault();
          }}
        />
        <button
          type="button"
          aria-label="Tăng số lượng"
          onClick={() => setQuantityText(value => String(BigInt(value || "0") + BigInt(1)))}
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
      </div>}
      {stock.status !== "sold_out" && quantityText !== "" && !validQuantity && <small role="alert" className={styles.quantityError}>
        {quantity === 0 ? "Số lượng phải lớn hơn 0." : "Số lượng quá lớn để xử lý. Vui lòng kiểm tra lại."}
      </small>}

      <div className={styles.purchaseActions}>
        {stock.status === "sold_out" ? <p role="status" className={styles.soldOut}>Hết hàng</p> : stock.status === "error" ? <div>
          <p role="alert">Không kiểm tra được tồn kho. Vui lòng thử lại.</p>
          <button type="button" onClick={stock.reload}>Kiểm tra lại tồn kho</button>
        </div> : <>
        {product ? (
          <AddToCartButton
            className={styles.cartButton}
            product={{ id: product.id, sku: product.sku }}
            quantity={quantity}
            disabled={!validQuantity}
            stock={stock}
          />
        ) : (
          <button className={styles.cartButton} type="button" disabled>
            Sản phẩm chưa khả dụng
          </button>
        )}
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={stock.status !== "available" || shop.cartLoading || !product || !validQuantity}
          className={styles.buyNowButton}
        >
          <span aria-hidden="true">⚡</span>
          <span>Mua ngay</span>
        </button>
        </>}
      </div>
    </div>
  );
}

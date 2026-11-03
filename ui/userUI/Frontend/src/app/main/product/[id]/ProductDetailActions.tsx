"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";
import { useProductStock, type ProductStock } from "@/lib/catalog/useProductStock";
import type { DetailProduct } from "@/data/product-details";
import styles from "./detail.module.css";

function clampQuantity(value: string, maximum: number | undefined) {
  return value !== "" && maximum !== undefined && maximum > 0 && Number(value) > maximum ? String(maximum) : value;
}

export function ProductDetailActions({
  product,
  price,
  currency = "VND",
  stock: providedStock,
}: {
  product?: DetailProduct;
  price?: number;
  currency?: string;
  stock?: ProductStock;
}) {
  const router = useRouter();
  const shop = useShopping();
  const ownStock = useProductStock(product, providedStock === undefined, true);
  const stock = providedStock ?? ownStock;
  const inCart = shop.lines.find(line => line.sku === product?.sku)?.quantity ?? 0;
  const maximum = stock.availableQuantity === undefined ? undefined : Math.max(0, stock.availableQuantity - inCart);
  const [draft, setDraft] = useState({ productId: product?.id, maximum, text: "1" });
  // Adjust the draft when its product or live bound changes, before rendering.
  // Keeping this in state prevents an old, larger draft from returning after restock.
  if (draft.productId !== product?.id || draft.maximum !== maximum) {
    setDraft({ productId: product?.id, maximum, text: draft.productId !== product?.id ? "1" : clampQuantity(draft.text, maximum) });
  }
  const quantityText = draft.productId === product?.id ? clampQuantity(draft.text, maximum) : "1";
  const setQuantityText = (value: string) => setDraft({ productId: product?.id, maximum, text: clampQuantity(value, maximum) });
  const quantity = Number(quantityText);
  const cartAtLimit = stock.status === "available" && maximum === 0;
  const validQuantity = quantityText !== "" && Number.isSafeInteger(quantity) && quantity > 0 && maximum !== undefined && quantity <= maximum;

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

      {!["sold_out", "inactive"].includes(stock.status) && !cartAtLimit && <div className={styles.quantityControls}>
        <span style={{ fontSize: 13, color: "#666" }}>Số lượng:</span>
        <button
          type="button"
          aria-label="Giảm số lượng"
          onClick={() => setQuantityText(String(Math.max(1, quantity - 1)))}
          style={{
            width: 28,
            height: 28,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
          disabled={stock.status !== "available" || quantityText === "" || quantity <= 1}
        >
          -
        </button>
        <input
          className={styles.quantityInput}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          min={1}
          max={maximum}
          disabled={stock.status !== "available" || maximum === undefined}
          aria-label="Số lượng"
          aria-invalid={maximum !== undefined && quantityText !== "" && !validQuantity}
          value={quantityText}
          onChange={event => {
            if (/^\d*$/.test(event.target.value)) setQuantityText(event.target.value);
          }}
          onBlur={() => {
            if (quantityText === "") setQuantityText("1");
            else if (quantity === 0) setQuantityText("1");
            else if (validQuantity) setQuantityText(String(quantity));
          }}
          onKeyDown={event => {
            if (["-", "+", ".", ",", "e", "E"].includes(event.key)) event.preventDefault();
          }}
        />
        <button
          type="button"
          aria-label="Tăng số lượng"
          onClick={() => setQuantityText(String((Number(quantityText) || 0) + 1))}
          disabled={stock.status !== "available" || maximum === undefined || quantity >= maximum}
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
      {maximum !== undefined && maximum > 0 && <small className={styles.quantityLimit}>Có thể thêm tối đa {maximum.toLocaleString("vi-VN")}{inCart > 0 ? ` · Đã có ${inCart.toLocaleString("vi-VN")} trong giỏ` : ""}</small>}
      {maximum !== undefined && !cartAtLimit && !["sold_out", "inactive"].includes(stock.status) && quantityText !== "" && !validQuantity && <small role="alert" className={styles.quantityError}>
        {quantity === 0 ? "Số lượng phải lớn hơn 0." : "Số lượng quá lớn để xử lý. Vui lòng kiểm tra lại."}
      </small>}

      <div className={styles.purchaseActions}>
        {stock.status === "sold_out" || stock.status === "inactive" ? <p role="status" className={styles.soldOut}>{stock.status === "inactive" ? "Tạm ngừng bán" : "Hết hàng"}</p> : cartAtLimit ? <p role="status" className={styles.quantityLimit}>Giỏ hàng đã đạt tồn khả dụng. <Link href="/cart">Xem giỏ hàng</Link></p> : stock.status === "error" ? <div>
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

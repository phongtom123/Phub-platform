"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { CartProduct } from "./cartData";
import { cartPage1Data } from "./cartData";
import styles from "./CartPage1.module.css";

interface CartItemListProps {
  items: CartProduct[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
}

export function CartItemList({ items, onUpdateQuantity, onRemoveItem }: CartItemListProps) {
  const [notice, setNotice] = useState("");

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function handleUpdateCart() {
    setNotice("Giỏ hàng đã được cập nhật thành công.");
    setTimeout(() => setNotice(""), 3500);
  }

  function handleEditClick(name: string) {
    setNotice(`Đang mở chế độ chỉnh sửa cho "${name.slice(0, 30)}..."`);
    setTimeout(() => setNotice(""), 3500);
  }

  if (items.length === 0) {
    return (
      <div className={styles.emptyCart}>
        <p className={styles.emptyCartTitle}>{cartPage1Data.labels.emptyCart}</p>
        <Link href="/main/product" className={styles.continueShoppingBtn}>
          {cartPage1Data.labels.continueShopping}
        </Link>
      </div>
    );
  }

  return (
    <section className={styles.itemList} aria-label="Danh sách sản phẩm trong giỏ hàng">
      {items.map(item => (
        <article key={item.id} className={styles.cartItem}>
          <div className={styles.itemTop}>
            <Image
              src={item.image}
              alt={item.name}
              width={75}
              height={75}
              className={styles.itemImage}
            />
            <p className={styles.itemName}>{item.name}</p>
          </div>

          <div className={styles.itemDetailsRow}>
            {/* Price */}
            <div className={styles.detailCol}>
              <span className={styles.colLabel}>{cartPage1Data.labels.price}</span>
              <span className={styles.colValue}>{formatCurrency(item.price)}</span>
            </div>

            {/* Qty */}
            <div className={styles.detailCol}>
              <span className={styles.colLabel}>{cartPage1Data.labels.qty}</span>
              <div className={styles.qtyControl}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.qtyInput}
                  value={item.quantity}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateQuantity(item.id, isNaN(val) ? 1 : Math.max(1, val));
                  }}
                />
                <div className={styles.qtySpinners}>
                  <button
                    type="button"
                    className={styles.spinnerBtn}
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    aria-label="Tăng số lượng"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={styles.spinnerBtn}
                    onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    aria-label="Giảm số lượng"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>

            {/* Subtotal */}
            <div className={styles.detailCol}>
              <span className={styles.colLabel}>{cartPage1Data.labels.subtotal}</span>
              <span className={styles.colValue}>{formatCurrency(item.price * item.quantity)}</span>
            </div>

            {/* Actions */}
            <div className={styles.itemActions}>
              <button
                type="button"
                className={styles.actionCircleBtn}
                onClick={() => onRemoveItem(item.id)}
                aria-label="Xóa sản phẩm"
                title="Xóa sản phẩm"
              >
                ×
              </button>
              <button
                type="button"
                className={styles.actionCircleBtn}
                onClick={() => handleEditClick(item.name)}
                aria-label="Chỉnh sửa sản phẩm"
                title="Chỉnh sửa sản phẩm"
              >
                ✎
              </button>
            </div>
          </div>
        </article>
      ))}

      {/* Nút đen Update Shopping Cart */}
      <button
        type="button"
        className={styles.updateCartBtn}
        onClick={handleUpdateCart}
      >
        {cartPage1Data.labels.updateCart}
      </button>

      {notice && (
        <p className={styles.cartNotice} role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

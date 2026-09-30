"use client";
import { useState } from "react";
import styles from "./detail.module.css";

export function ProductDetailActions({ price, currency = "USD" }: { price: number; currency?: "USD" | "VND" }) {
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  return <div className={styles.buyArea}>
    <p>On Sale from <strong>{new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", { style: "currency", currency }).format(price)}</strong></p>
    <div className={styles.quantity} aria-label="Quantity"><strong>{quantity}</strong><span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity(value => value + 1)}>⌃</button><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(value => Math.max(1, value - 1))}>⌄</button></span></div>
    <button className={styles.cartButton} type="button" onClick={() => setNotice(`Added ${quantity} item${quantity > 1 ? "s" : ""} to the demo cart`)}>Add to Cart</button>
    <button className={styles.paypalButton} type="button" onClick={() => setNotice("PayPal checkout is a UI preview")}>PayPal</button>
    <span className={styles.srOnly} role="status">{notice}</span>
  </div>;
}

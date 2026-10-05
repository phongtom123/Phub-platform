"use client";

import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { CartSummaryCard } from "./CartSummaryCard";
import { CartItemList } from "./CartItemList";
import { cartPage1Data, initialCartProducts } from "./cartData";
import styles from "./CartPage1.module.css";

export function CartPage1() {
  const [items, setItems] = useState(initialCartProducts);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  function handleUpdateQuantity(id: string, qty: number) {
    setItems(current =>
      current.map(item => (item.id === id ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  }

  function handleRemoveItem(id: string) {
    setItems(current => current.filter(item => item.id !== id));
  }

  return (
    <article className={styles.page}>
      <Breadcrumb items={cartPage1Data.breadcrumbs} className={styles.breadcrumb} />
      <h1 className={styles.title}>{cartPage1Data.title}</h1>
      <CartSummaryCard subtotal={subtotal} itemCount={items.length} />
      <CartItemList
        items={items}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />
      <ServiceBenefits />
    </article>
  );
}

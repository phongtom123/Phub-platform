"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./cart.module.css";

type CartItem = { id: string; name: string; image: string; price: number; quantity: number };
const initialItems: CartItem[] = [
  { id: "trident", name: "MSI MEG Trident X 10SD-1012AU Intel i7 10700K, 2070 SUPER, 32GB RAM, 1TB SSD, Windows 10 Home, Gaming Keyboard and Mouse 3 Years Warranty", image: "/images/home/desktop-trident.svg", price: 4349, quantity: 2 },
  { id: "prestige", name: "MSI MEG Trident X 10SD-1012AU Intel i7 10700K, 2070 SUPER, 32GB RAM, 1TB SSD, Windows 10 Home, Gaming Keyboard and Mouse 3 Years Warranty", image: "/images/catalog/prestige-front.webp", price: 4349, quantity: 1 },
];

export function ShoppingCart() {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [discountOpen, setDiscountOpen] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "pickup">("standard");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notice, setNotice] = useState("");
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const shipping = items.length && shippingMethod === "standard" ? 21 : 0;
  const tax = items.length ? 1.91 : 0;
  const total = Math.max(0, subtotal + shipping + tax - discount);
  const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function setQuantity(id: string, quantity: number) { setItems(current => current.map(item => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)); }
  function remove(id: string) { setItems(current => current.filter(item => item.id !== id)); setNotice("Product removed from the demo cart."); }
  function applyDiscount() { const valid = code.trim().toUpperCase() === "TECH10"; setDiscount(valid ? Math.min(subtotal * .1, 100) : 0); setNotice(valid ? "TECH10 discount applied." : "Try the demo code TECH10."); }

  return <main className={styles.page}><div className={styles.container}>
    <nav className={styles.breadcrumb}><Link href="/">Home</Link><span>›</span><strong>Shopping Cart</strong></nav>
    <h1>Shopping Cart</h1>
    <div className={styles.layout}>
      <section className={styles.cartArea} aria-label="Shopping cart items">
        <div className={styles.tableHead}><span>Item</span><span>Price</span><span>Qty</span><span>Subtotal</span><span /></div>
        {items.length ? items.map(item => <article className={styles.item} key={item.id}>
          <div className={styles.product}><Image src={item.image} alt="" width={150} height={150} /><p>{item.name}</p></div>
          <strong>{money(item.price)}</strong>
          <label className={styles.qty}><span className={styles.srOnly}>Quantity for {item.name}</span><input type="number" min="1" value={item.quantity} onChange={event => setQuantity(item.id, Number(event.target.value) || 1)} /></label>
          <strong>{money(item.price * item.quantity)}</strong>
          <div className={styles.itemActions}><button type="button" aria-label="Remove product" onClick={() => remove(item.id)}>×</button><button type="button" aria-label="Edit product" onClick={() => setNotice("Product edit is a UI preview.")}>✎</button></div>
        </article>) : <div className={styles.empty}><h2>Your cart is empty.</h2><p>Add a product to continue shopping.</p></div>}
        <div className={styles.cartActions}><Link href="/main/product">Continue Shopping</Link><button type="button" onClick={() => { setItems([]); setNotice("Shopping cart cleared."); }}>Clear Shopping Cart</button><button type="button" onClick={() => setNotice("Shopping cart totals are up to date.")}>Update Shopping Cart</button></div>
        <p className={styles.notice} role="status">{notice}</p>
      </section>

      <aside className={styles.summary}>
        <h2>Summary</h2>
        <details open className={styles.shippingPanel}>
          <summary>Estimate Shipping and Tax</summary>
          <p>Enter your destination to get a shipping estimate.</p>
          <div className={styles.shippingForm}>
            <label>Country<select defaultValue="Australia"><option>Australia</option><option>Vietnam</option><option>United States</option></select></label>
            <label>State/Province<input type="text" /></label>
            <label>Zip/Postal Code<input type="text" inputMode="numeric" /></label>
            <fieldset><legend>Standard Rate</legend><label className={styles.radio}><input type="radio" name="shipping" checked={shippingMethod === "standard"} onChange={() => setShippingMethod("standard")} /><span>Price may vary depending on the item/destination.<br />Shop Staff will contact you. $21.00</span></label></fieldset>
            <fieldset><legend>Pickup from store</legend><label className={styles.radio}><input type="radio" name="shipping" checked={shippingMethod === "pickup"} onChange={() => setShippingMethod("pickup")} /><span>1234 Street Adress City Address, 1234 $0.00</span></label></fieldset>
          </div>
        </details>
        <div className={styles.discount}>
          <button type="button" className={styles.discountToggle} aria-expanded={discountOpen} onClick={() => setDiscountOpen(value => !value)}>Apply Discount Code <span>{discountOpen ? "⌃" : "⌄"}</span></button>
          {discountOpen && <div className={styles.discountForm}><label>Enter discount code<input value={code} onChange={event => setCode(event.target.value)} placeholder="Enter Discount code" /></label><button type="button" onClick={applyDiscount}>Apply Discount</button></div>}
        </div>
        <div className={styles.totals}><p><span>Subtotal</span><strong>{money(subtotal)}</strong></p><p><span>Shipping</span><strong>{money(shipping)}</strong></p><small>(Standard Rate - Price may vary depending on the item/destination. TECS Staff will contact you.)</small><p><span>Tax</span><strong>{money(tax)}</strong></p><p><span>GST (10%)</span><strong>{money(tax)}</strong></p>{discount > 0 && <p><span>Discount</span><strong>-{money(discount)}</strong></p>}<p className={styles.orderTotal}><span>Order Total</span><strong>{money(total)}</strong></p></div>
        <button className={styles.checkout} type="button" disabled={!items.length} onClick={() => router.push("/checkout")}>Proceed to Checkout</button>
        <button className={styles.paypal} type="button" disabled={!items.length} onClick={() => setNotice("PayPal checkout is a UI preview.")}>Check out with <b>PayPal</b></button>
        <button className={styles.multiple} type="button" disabled>Check Out with Multiple Addresses</button>
        <div className={styles.zip}><Image src="/images/home/zip.svg" alt="Zip" width={66} height={28} /><span>own it now, up to 6 months interest free</span></div>
      </aside>
    </div>
  </div><div className={styles.bottomSpace} /></main>;
}

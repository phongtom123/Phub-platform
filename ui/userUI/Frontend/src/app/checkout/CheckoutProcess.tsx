"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "./checkout.module.css";

const products = [
  { id: "trident", image: "/images/home/desktop-trident.svg", name: "MSI MEG Trident X 10SD-1012AU Intel i7 10700K, 2070 SUPER...", price: "$3,799.00" },
  { id: "prestige", image: "/images/catalog/prestige-front.webp", name: "MSI MEG Trident X 10SD-1012AU Intel i7 10700K, 2070 SUPER...", price: "$3,799.00" },
];

export function CheckoutProcess() {
  const [step, setStep] = useState<1 | 2>(1);
  const [shipping, setShipping] = useState<"standard" | "pickup">("standard");
  const [payment, setPayment] = useState("card");
  const [placed, setPlaced] = useState(false);

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <main className={styles.page}><div className={styles.container}>
    <nav className={styles.breadcrumb}><Link href="/">Home</Link><span>›</span><Link href="/cart">Shopping Cart</Link><span>›</span><strong>Checkout Process</strong></nav>
    <div className={styles.headingRow}><h1>Checkout</h1><Link className={styles.signIn} href="/auth/login">Sign In</Link><CheckoutSteps step={step} /></div>
    <div className={styles.layout}>
      <section className={styles.checkoutMain}>
        {step === 1 ? <form className={styles.form} onSubmit={next}>
          <h2>Shipping Address</h2>
          <label>Email Address <em>*</em><input type="email" autoComplete="email" required /><small>You can create an account after checkout.</small></label>
          <div className={styles.divider} />
          <label>First Name <em>*</em><input autoComplete="given-name" required /></label>
          <label>Last Name <em>*</em><input autoComplete="family-name" required /></label>
          <label>Company <em>*</em><input autoComplete="organization" required /></label>
          <label>Street Address <em>*</em><input autoComplete="address-line1" required /><input autoComplete="address-line2" aria-label="Street address line 2" /></label>
          <label>City <em>*</em><input autoComplete="address-level2" required /></label>
          <label>State/Province <em>*</em><select defaultValue="" autoComplete="address-level1" required><option value="" disabled>Please, select a region, state or province</option><option>California</option><option>New South Wales</option><option>Ho Chi Minh City</option></select></label>
          <label>Zip/Postal Code <em>*</em><input autoComplete="postal-code" required /></label>
          <label>Country <em>*</em><select defaultValue="United States" autoComplete="country-name" required><option>United States</option><option>Australia</option><option>Vietnam</option></select></label>
          <label>Phone Number <em>*</em><input type="tel" autoComplete="tel" required /></label>
          <div className={styles.shippingMethods}>
            <fieldset><legend>Standard Rate</legend><label><input type="radio" name="shipping" checked={shipping === "standard"} onChange={() => setShipping("standard")} /><span>Price may vary depending on the item/destination. Shop Staff will contact you. $21.00</span><strong>$21.00</strong></label></fieldset>
            <fieldset><legend>Pickup from store</legend><label><input type="radio" name="shipping" checked={shipping === "pickup"} onChange={() => setShipping("pickup")} /><span>1234 Street Adress City Address, 1234</span><strong>$0.00</strong></label></fieldset>
          </div>
          <button className={styles.next} type="submit">Next</button>
        </form> : <section className={styles.review}>
          <h2>Review &amp; Payments</h2>
          <div className={styles.reviewBlock}><h3>Shipping Information</h3><p>Your entered shipping information has been validated for this UI preview.</p><button type="button" onClick={() => setStep(1)}>Edit Shipping</button></div>
          <div className={styles.reviewBlock}><h3>Shipping Method</h3><p>{shipping === "standard" ? "Standard Rate — $21.00" : "Pickup from store — $0.00"}</p></div>
          <div className={styles.payment}><h3>Payment Method</h3><label><input type="radio" name="payment" checked={payment === "card"} onChange={() => setPayment("card")} /> Credit or Debit Card</label><label><input type="radio" name="payment" checked={payment === "paypal"} onChange={() => setPayment("paypal")} /> PayPal</label>{payment === "card" && <div className={styles.cardFields}><input placeholder="Card number" inputMode="numeric" /><input placeholder="MM / YY" /><input placeholder="CVV" inputMode="numeric" /></div>}</div>
          <button className={styles.placeOrder} type="button" onClick={() => setPlaced(true)}>Place Order</button>
          {placed && <p className={styles.success} role="status">Order placed successfully in this UI preview. No real payment was made.</p>}
        </section>}
      </section>
      <OrderSummary shipping={shipping} />
    </div>
  </div><div className={styles.bottomSpace} /></main>;
}

function CheckoutSteps({ step }: { step: 1 | 2 }) { return <div className={styles.steps}><div className={step >= 1 ? styles.current : ""}><i>{step > 1 ? "✓" : "✓"}</i><span>Shipping</span></div><div className={step === 2 ? styles.current : ""}><i>2</i><span>Review &amp; Payments</span></div></div>; }
function OrderSummary({ shipping }: { shipping: "standard" | "pickup" }) { return <aside className={styles.summary}><h2>Order Summary</h2><div className={styles.summaryHead}><span>2 Items in Cart</span><b>⌃</b></div>{products.map(product => <article key={product.id}><Image src={product.image} alt="" width={75} height={75} /><div><p>{product.name}</p><small>Qty 1</small><strong>{product.price}</strong></div></article>)}<div className={styles.summaryTotals}><p><span>Shipping</span><b>{shipping === "standard" ? "$21.00" : "$0.00"}</b></p><p><span>Order Total</span><b>{shipping === "standard" ? "$7,619.00" : "$7,598.00"}</b></p></div></aside>; }

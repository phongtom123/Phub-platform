"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { StockStatus } from "@/components/common/StockStatus";
import type { HomeProduct } from "./homeData";
import styles from "./Home.module.css";

export type HomeDialogContent =
  | { type: "product"; product: HomeProduct }
  | { type: "catalog"; title: string; products: HomeProduct[] }
  | { type: "financing" };

export function HomeDialog({ content, onClose, onSelect }: { content: HomeDialogContent; onClose: () => void; onSelect: (product: HomeProduct) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  const title = content.type === "product" ? content.product.name : content.type === "catalog" ? content.title : "About this Zip preview";
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="home-dialog-heading" aria-describedby="home-demo-note" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogBody}>
      <button className={styles.close} aria-label="Close preview" onClick={onClose} autoFocus>×</button>
      <h2 id="home-dialog-heading">{title}</h2>
      <p id="home-demo-note" className={styles.demoNote}>UI preview only. Product names, prices, stock and reviews are sample data. No purchase will be made.</p>
      {content.type === "product" && <div className={styles.productPreview}>
        <Image src={content.product.imageSrc} alt={content.product.name} width={280} height={280} />
        <div>
          <StockStatus status={content.product.stock ?? "in-stock"} />
          <Price amount={content.product.amount} originalAmount={content.product.originalAmount} />
          <p>Explore our sample Tech Store collection. Checkout is not connected.</p>
          <p><Link href={`/main/product/${content.product.id}`} onClick={onClose} className="text-blue-600 underline">View product details</Link></p>
          <Button onClick={onClose}>Continue browsing</Button>
        </div>
      </div>}
      {content.type === "catalog" && <div className={styles.catalogGrid}>
        {content.products.map(product => <button className={styles.catalogItem} key={product.id} onClick={() => { onSelect(product); dialog.current?.scrollTo(0, 0); }}>
          <Image src={product.imageSrc} alt="" width={150} height={150} />
          <span>{product.name}</span><Price amount={product.amount} originalAmount={product.originalAmount} />
        </button>)}
      </div>}
      {content.type === "financing" && <p>The Zip strip recreates the supplied design. It is not an active credit offer, and no payment or financing service is connected.</p>}
    </div>
  </dialog>;
}

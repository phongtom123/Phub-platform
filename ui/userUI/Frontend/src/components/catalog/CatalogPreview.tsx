"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { StockStatus } from "@/components/common/StockStatus";
import type { CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

export function CatalogPreview({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  return <dialog ref={dialog} className={styles.preview} aria-labelledby="catalog-preview-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.previewContent}>
      <button className={styles.close} onClick={onClose} aria-label="Close product preview" autoFocus>×</button>
      <h2 id="catalog-preview-title">{product.name}</h2>
      <p className={styles.demoNotice}>UI preview — sample prices, stock, colors and category tags. No checkout is connected.</p>
      <div className={styles.previewGrid}>
        <Image src={product.imageSrc} alt={product.name} width={300} height={280} />
        <div><StockStatus status={product.stock ?? "in-stock"} /><Price amount={product.amount} originalAmount={product.originalAmount} /><p>Product code: {product.id.toUpperCase()}</p><p><Link href={`/main/product/${product.id}`} onClick={onClose} className="text-blue-600 underline">View product details</Link></p><Button onClick={onClose}>Continue browsing</Button></div>
      </div>
    </div>
  </dialog>;
}

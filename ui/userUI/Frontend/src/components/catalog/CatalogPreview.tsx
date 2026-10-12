"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { CatalogImage } from "@/components/common/CatalogImage";
import { productHref } from "@/lib/catalog/types";
import type { CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

export function CatalogPreview({ product, onClose, locale = "en", imageSrc }: { product: CatalogProduct; onClose: () => void; locale?: "en" | "vi"; imageSrc?: string }) {
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
      <button className={styles.close} onClick={onClose} aria-label={locale === "vi" ? "Đóng xem nhanh" : "Close product preview"} autoFocus>×</button>
      <h2 id="catalog-preview-title">{product.name}</h2>
      <div className={styles.previewGrid}>
        <CatalogImage src={imageSrc ?? product.imageSrc} alt={product.name} width={300} height={280} />
        <div><Price amount={product.amount} originalAmount={product.originalAmount} currency={product.currency} locale={product.locale} uiLocale={locale} /><p>SKU: {product.sku}</p><p>{product.description || "Chưa có mô tả sản phẩm."}</p><p><Link href={productHref(product.id)} onClick={onClose} className="text-blue-600 underline">Xem chi tiết sản phẩm</Link></p><Button onClick={onClose}>Tiếp tục xem sản phẩm</Button></div>
      </div>
    </div>
  </dialog>;
}

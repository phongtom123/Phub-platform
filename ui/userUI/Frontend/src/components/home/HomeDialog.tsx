"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/common/Button";
import { Price } from "@/components/common/Price";
import { CatalogImage } from "@/components/common/CatalogImage";
import { productHref } from "@/lib/catalog/types";
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
  const title = content.type === "product" ? content.product.name : content.type === "catalog" ? content.title : "Thông tin thanh toán Zip";
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="home-dialog-heading" aria-describedby="home-demo-note" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogBody}>
      <button className={styles.close} aria-label="Đóng cửa sổ" onClick={onClose} autoFocus>×</button>
      <h2 id="home-dialog-heading">{title}</h2>
      <p id="home-demo-note" className={styles.demoNote}>{content.type === "financing" ? "Dịch vụ trả góp hiện chưa được kết nối." : "Xem chi tiết để biết mô tả và thông số sản phẩm."}</p>
      {content.type === "product" && <div className={styles.productPreview}>
        <CatalogImage src={content.product.imageSrc} alt={content.product.name} width={280} height={280} />
        <div>
          <Price amount={content.product.amount} originalAmount={content.product.originalAmount} currency={content.product.currency} locale="vi-VN" uiLocale="vi" />
          <p>Khám phá bộ sưu tập sản phẩm của Tech Store.</p>
          <p><Link href={productHref(content.product.id)} onClick={onClose} className="text-blue-600 underline">Xem chi tiết sản phẩm</Link></p>
          <Button onClick={onClose}>Tiếp tục xem sản phẩm</Button>
        </div>
      </div>}
      {content.type === "catalog" && <div className={styles.catalogGrid}>
        {content.products.map(product => <button className={styles.catalogItem} key={product.id} onClick={() => { onSelect(product); dialog.current?.scrollTo(0, 0); }}>
          <CatalogImage src={product.imageSrc} alt="" width={150} height={150} />
          <span>{product.name}</span><Price amount={product.amount} originalAmount={product.originalAmount} currency={product.currency} locale="vi-VN" uiLocale="vi" />
        </button>)}
      </div>}
      {content.type === "financing" && <p>Thông tin Zip là nội dung mẫu theo thiết kế. Dịch vụ trả góp hiện chưa được kết nối.</p>}
    </div>
  </dialog>;
}

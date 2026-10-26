"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Price, type PriceProps } from "./Price";
import { Rating } from "./Rating";
import { StockStatus, type StockStatusProps } from "./StockStatus";
import styles from "./store.module.css";
import { CatalogImage } from "./CatalogImage";

export interface ProductCardProps extends PriceProps {
  name: string;
  href: string;
  imageSrc: string;
  imageAlt?: string;
  rating?: number;
  reviewCount?: number;
  stock?: StockStatusProps["status"];
  actions?: ReactNode;
  onSelect?: () => void;
  mobileImageSrc?: string;
  compactOnMobile?: boolean;
  uiLocale?: "en" | "vi";
}

/** Shared by home/catalog. Product data and cart actions belong to the caller. */
export function ProductCard({ name, href, imageSrc, imageAlt, rating, reviewCount, stock, actions, className, onSelect, mobileImageSrc, compactOnMobile = false, uiLocale = "en", ...price }: ProductCardProps) {
  const image = <picture>{mobileImageSrc && <source media="(max-width: 760px)" srcSet={mobileImageSrc} />}<CatalogImage src={imageSrc} alt={imageAlt ?? name} width={150} height={150} /></picture>;
  return (
    <article className={[styles.productCard, compactOnMobile && styles.compactCard, className].filter(Boolean).join(" ")}>
      {stock && <StockStatus status={stock} label={uiLocale === "vi" ? (stock === "in-stock" ? "Còn hàng" : "Liên hệ") : undefined} />}
      {onSelect ? <button type="button" className={styles.productImage} aria-label={name} onClick={onSelect}>{image}</button>
        : <Link href={href} className={styles.productImage} aria-label={name}>{image}</Link>}
      {rating !== undefined && <Rating value={rating} reviewCount={reviewCount} locale={uiLocale} compact={compactOnMobile} />}
      {onSelect ? <button type="button" className={styles.productName} onClick={onSelect}>{name}</button>
        : <Link href={href} className={styles.productName}>{name}</Link>}
      <Price {...price} uiLocale={uiLocale} />
      {actions && <div className={styles.productActions}>{actions}</div>}
    </article>
  );
}

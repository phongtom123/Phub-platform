"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Price, type PriceProps } from "./Price";
import { Rating } from "./Rating";
import { StockStatus, type StockStatusProps } from "./StockStatus";
import styles from "./store.module.css";

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
}

/** Shared by home/catalog. Product data and cart actions belong to the caller. */
export function ProductCard({ name, href, imageSrc, imageAlt, rating, reviewCount, stock, actions, className, onSelect, ...price }: ProductCardProps) {
  const image = <Image src={imageSrc} alt={imageAlt ?? name} width={150} height={150} />;
  return (
    <article className={[styles.productCard, className].filter(Boolean).join(" ")}>
      {stock && <StockStatus status={stock} />}
      {onSelect ? <button type="button" className={styles.productImage} aria-label={name} onClick={onSelect}>{image}</button>
        : <Link href={href} className={styles.productImage} aria-label={name}>{image}</Link>}
      {rating !== undefined && <Rating value={rating} reviewCount={reviewCount} />}
      {onSelect ? <button type="button" className={styles.productName} onClick={onSelect}>{name}</button>
        : <Link href={href} className={styles.productName}>{name}</Link>}
      <Price {...price} />
      {actions && <div className={styles.productActions}>{actions}</div>}
    </article>
  );
}

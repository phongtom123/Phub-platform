"use client";

import Image from "next/image";
import { Button } from "./Button";
import { IconButton } from "./icon";
import { Price } from "./Price";
import { Rating } from "./Rating";
import { SpecsTable, type SpecsTableProps } from "./SpecsTable";
import { StockStatus } from "./StockStatus";
import type { ProductCardProps } from "./ProductCard";
import styles from "./ProductListCard.module.css";
import { CatalogImage } from "./CatalogImage";

export interface ProductListCardProps extends Omit<ProductCardProps, "href" | "actions" | "onSelect"> {
  sku: string;
  description?: string;
  specifications: SpecsTableProps["rows"];
  inCart?: boolean;
  compared?: boolean;
  wished?: boolean;
  onSelect: () => void;
  onCart: () => void;
  onCompare: () => void;
  onWish: () => void;
  onEnquire: () => void;
}

/** Presentational catalog row. The caller owns data and demo/real action state. */
export function ProductListCard({ name, imageSrc, imageAlt, sku, description, specifications, amount, originalAmount, currency, locale, rating, reviewCount, stock, inCart = false, compared = false, wished = false, onSelect, onCart, onCompare, onWish, onEnquire, className }: ProductListCardProps) {
  return <article className={[styles.card, className].filter(Boolean).join(" ")} aria-label={name}>
    <div className={styles.body}>
      <div className={styles.media}>
        <button className={styles.imageButton} type="button" onClick={onSelect} aria-label={`Preview ${name}`}><CatalogImage src={imageSrc} alt={imageAlt ?? name} width={280} height={240} sizes="(max-width: 540px) 160px, 280px" /></button>
        {rating !== undefined && <Rating value={rating} reviewCount={reviewCount} className={styles.rating} />}
      </div>
      <div className={styles.details}>
        <p className={styles.sku}>SKU {sku}</p>
        <h2><button type="button" onClick={onSelect}>{name}{description && <span> — {description}</span>}</button></h2>
        <Price amount={amount} originalAmount={originalAmount} currency={currency} locale={locale} className={styles.price} />
        <Button variant="outlinePrimary" className={styles.cart} onClick={onCart} aria-label={`Thêm vào giỏ: ${name}`}>
          <Image src="/icons/header/cart.svg" alt="" width={20} height={20} />{inCart ? "Added To Cart" : "Add To Cart"}
        </Button>
      </div>
      <div className={styles.side}>
        {stock && <StockStatus status={stock} className={styles.stock} />}
        <SpecsTable rows={specifications} caption={`${name} specifications`} className={styles.specs} />
        <div className={styles.actions}>
          <IconButton label={`Ask about ${name}`} onClick={onEnquire}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 6 9 7 9-7" /></svg></IconButton>
          <IconButton label={`${compared ? "Remove from" : "Add to"} comparison: ${name}`} aria-pressed={compared} onClick={onCompare}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 18V9m6 9V4m6 14v-6" /></svg></IconButton>
          <IconButton label={`${wished ? "Remove from" : "Add to"} wish list: ${name}`} aria-pressed={wished} onClick={onWish}><svg width="20" height="20" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 20s-9-5.5-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-9 11-9 11Z" /></svg></IconButton>
        </div>
      </div>
    </div>
  </article>;
}

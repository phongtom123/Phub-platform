"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { ProductCard } from "@/components/common/ProductCard";
import type { HomeCategory, HomeProduct } from "./homeData";
import styles from "./Home.module.css";

interface SelectionProps { onSelect: (product: HomeProduct) => void }
function Card({ product, onSelect, compact = false }: SelectionProps & { product: HomeProduct; compact?: boolean }) {
  return <ProductCard {...product} mobileImageSrc={undefined} uiLocale="vi" compactOnMobile={compact} href="#" className={styles.card} onSelect={() => onSelect(product)} />;
}
export function NewProducts({ products, onSelect, onViewAll }: SelectionProps & { products: HomeProduct[]; onViewAll: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
    const atStart = element.scrollLeft <= 2;
    const left = direction > 0 && atEnd ? 0 : direction < 0 && atStart ? element.scrollWidth : element.scrollLeft + direction * element.clientWidth;
    element.scrollTo({ left, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <section className={styles.newProducts} aria-labelledby="new-products-heading" id="new-products">
    <div className={styles.sectionHeading}><h2 id="new-products-heading">Sản phẩm mới</h2><button className={styles.textLink} onClick={onViewAll}>Xem tất cả</button></div>
    <div className={styles.carousel}>
      <div ref={track} className={styles.productTrack} tabIndex={0} aria-label="Sản phẩm mới — cuộn để xem thêm">
        {products.map(product => <Card key={product.id} product={product} onSelect={onSelect} compact />)}
      </div>
      <button className={`${styles.arrow} ${styles.previous}`} onClick={() => move(-1)} aria-label="Sản phẩm trước">‹</button>
      <button className={`${styles.arrow} ${styles.next}`} onClick={() => move(1)} aria-label="Sản phẩm tiếp theo">›</button>
    </div>
  </section>;
}
export function ProductShelf({ category, onSelect, onViewAll }: SelectionProps & { category: HomeCategory; onViewAll: (title: string, products: HomeProduct[]) => void }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<HTMLDivElement>(null);
  const group = category.groups[active];
  const hasTabs = category.groups.length > 1;
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % category.groups.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + category.groups.length) % category.groups.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = category.groups.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }
  return <section id={category.id} className={styles.shelf} aria-label={category.title}>
    {hasTabs && <div ref={tabs} role="tablist" aria-label={`${category.title} series`} className={styles.tabs}>
      {category.groups.map((item, index) => <button key={item.label} id={`${category.id}-tab-${index}`} role="tab" aria-selected={index === active} aria-controls={`${category.id}-panel`} tabIndex={index === active ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => handleKey(event, index)}>{item.label}</button>)}
    </div>}
    <div id={`${category.id}-panel`} className={styles.categoryRow} role={hasTabs ? "tabpanel" : undefined} aria-labelledby={hasTabs ? `${category.id}-tab-${active}` : undefined} tabIndex={hasTabs ? 0 : undefined}>
      <div className={styles.categoryBanner}>
        <picture><Image src={`/images/home/${category.image}`} alt="" fill unoptimized /></picture>
        <h2>{category.title}</h2>
        <button onClick={() => onViewAll(category.title, category.groups.flatMap(item => item.products))}>Xem tất cả sản phẩm</button>
      </div>
      <div className={styles.categoryProducts} tabIndex={0} aria-label={`${group.label} products`}>
        {group.products.map(product => <Card key={product.id} product={product} onSelect={onSelect} />)}
      </div>
    </div>
  </section>;
}

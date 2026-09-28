"use client";

import Image from "next/image";
import { useState } from "react";
import { BrandTile } from "@/components/common/BrandTile";
import { HeroBanner } from "./HeroBanner";
import { HomeDialog, type HomeDialogContent } from "./HomeDialog";
import { NewProducts, ProductShelf } from "./ProductShelf";
import { brands, categories, newProducts, type HomeProduct } from "./homeData";
import styles from "./Home.module.css";

export function HomePage() {
  const [dialog, setDialog] = useState<HomeDialogContent | null>(null);
  const selectProduct = (product: HomeProduct) => setDialog({ type: "product", product });
  const showCatalog = (title: string, products: HomeProduct[]) => setDialog({ type: "catalog", title, products });
  return <div className={styles.home}>
    <div className={styles.container}>
      <h1 className={styles.srOnly}>Tech Store — Computers, Laptops &amp; Gaming</h1>
      <HeroBanner />
      <NewProducts products={newProducts} onSelect={selectProduct} onViewAll={() => showCatalog("All New Products", newProducts)} />
      <div className={styles.zipStrip}>
        <Image src="/images/home/zip.svg" alt="Zip" width={77} height={27} />
        <p><strong>own</strong> it now, up to 6 months interest free <button onClick={() => setDialog({ type: "financing" })}>learn more</button></p>
      </div>
      {categories.map(category => <ProductShelf key={category.id} category={category} onSelect={selectProduct} onViewAll={showCatalog} />)}
      <section className={styles.brands} aria-label="Our brands">
        {brands.map(brand => <BrandTile key={brand.id} name={brand.name} src={`/images/brands/${brand.id}.png`} width={153} height={80} loading="lazy" containerClassName={styles.brandTile} />)}
      </section>
    </div>
    <a className={styles.support} href="#footer-contact" aria-label="Contact Tech Store">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-9 9c-1.4 0-2.7-.3-3.9-.9L3 21l1.4-4.6A9 9 0 1 1 21 11.5Z" fill="currentColor" /><path d="m7 14 4-4 3 2 3-3" stroke="#0156ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </a>
    {dialog && <HomeDialog content={dialog} onClose={() => setDialog(null)} onSelect={selectProduct} />}
  </div>;
}

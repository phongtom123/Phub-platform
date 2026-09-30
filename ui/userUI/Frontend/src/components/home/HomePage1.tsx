"use client";

import { useState } from "react";
import { FinancingStrip } from "./FinancingStrip";
import { BrandSection } from "./BrandSection";
import { CustomerTestimonials } from "@/components/mobile/home-page-1/CustomerTestimonials";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { HomeFloatingActions } from "./HomeFloatingActions";
import { HeroBanner } from "./HeroBanner";
import { HomeDialog, type HomeDialogContent } from "./HomeDialog";
import { NewProducts, ProductShelf } from "./ProductShelf";
import { categories, newProducts, type HomeProduct } from "./homeData";
import styles from "./Home.module.css";

export function HomePage1() {
  const [dialog, setDialog] = useState<HomeDialogContent | null>(null);
  const selectProduct = (product: HomeProduct) => {
    setDialog({ type: "product", product });
  };
  const showCatalog = (title: string, products: HomeProduct[]) => setDialog({ type: "catalog", title, products });
  return <div className={styles.home}>
    <div className={styles.container}>
      <h1 className={styles.srOnly}>Tech Store — Máy tính, laptop và thiết bị gaming</h1>
      <HeroBanner />
      <NewProducts products={newProducts} onSelect={selectProduct} onViewAll={() => showCatalog("Sản phẩm mới", newProducts)} />
      <FinancingStrip onLearnMore={() => setDialog({ type: "financing" })} />
      {categories.map(category => <ProductShelf key={category.id} category={category} onSelect={selectProduct} onViewAll={showCatalog} />)}
      <BrandSection />
      <CustomerTestimonials />
    </div>
    <ServiceBenefits />
    <HomeFloatingActions />
    {dialog && <HomeDialog content={dialog} onClose={() => setDialog(null)} onSelect={selectProduct} />}
  </div>;
}

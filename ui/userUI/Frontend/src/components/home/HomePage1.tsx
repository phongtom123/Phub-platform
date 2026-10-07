"use client";

import { useState } from "react";
import { FinancingStrip } from "./FinancingStrip";
import { BrandSection } from "./BrandSection";
import { CustomerTestimonials } from "@/components/mobile/home-page-1/CustomerTestimonials";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { HomeFloatingActions } from "./HomeFloatingActions";
import { HeroBanner } from "./HeroBanner";
import { HomeDialog, type HomeDialogContent } from "./HomeDialog";
import { HomeFeaturedProducts, HomeCategoryProducts } from "./LiveHomeProducts";
import type { HomeProduct } from "./homeData";
import styles from "./Home.module.css";

export function HomePage1() {
  const [dialog, setDialog] = useState<HomeDialogContent | null>(null);
  const selectProduct = (product: HomeProduct) => {
    setDialog({ type: "product", product });
  };
  return <div className={styles.home}>
    <div className={styles.container}>
      <h1 className={styles.srOnly}>Tech Store — Máy tính, laptop và thiết bị gaming</h1>
      <HeroBanner />
      <HomeFeaturedProducts onSelect={selectProduct} />
      <FinancingStrip onLearnMore={() => setDialog({ type: "financing" })} />
      <HomeCategoryProducts onSelect={selectProduct} />
      <BrandSection />
      <CustomerTestimonials />
    </div>
    <ServiceBenefits />
    <HomeFloatingActions />
    {dialog && <HomeDialog content={dialog} onClose={() => setDialog(null)} onSelect={selectProduct} />}
  </div>;
}

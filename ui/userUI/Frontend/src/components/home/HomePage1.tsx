"use client";

import { BrandSection } from "./BrandSection";
import { CustomerTestimonials } from "@/components/mobile/home-page-1/CustomerTestimonials";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { HomeFloatingActions } from "./HomeFloatingActions";
import { HeroBanner } from "./HeroBanner";
import { HomeFeaturedProducts, HomeCategoryProducts } from "./LiveHomeProducts";
import styles from "./Home.module.css";

export function HomePage1() {
  return <div className={styles.home}>
    <div className={styles.container}>
      <HeroBanner />
      <HomeFeaturedProducts />
      <HomeCategoryProducts />
      <BrandSection />
      <CustomerTestimonials />
    </div>
    <ServiceBenefits />
    <HomeFloatingActions />
  </div>;
}

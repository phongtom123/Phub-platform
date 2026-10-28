"use client";

import { BrandSection } from "./BrandSection";
import { CustomerTestimonials } from "@/components/mobile/home-page-1/CustomerTestimonials";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { HomeFloatingActions } from "./HomeFloatingActions";
import { HomeMediaHints } from "./HomeMediaHints";
import { HeroBanner } from "./HeroBanner";
import { HomeFeaturedProducts, HomeCategoryProducts } from "./LiveHomeProducts";
import { useCatalogMetadata } from "@/lib/catalog/useCatalog";
import styles from "./Home.module.css";

export function HomePage1() {
  const metadata = useCatalogMetadata();
  return <div className={styles.home}>
    <HomeMediaHints />
    <div className={styles.container}>
      <HeroBanner />
      <HomeFeaturedProducts />
      <HomeCategoryProducts metadata={metadata} />
      <BrandSection metadata={metadata} />
      <CustomerTestimonials />
    </div>
    <ServiceBenefits />
    <HomeFloatingActions />
  </div>;
}

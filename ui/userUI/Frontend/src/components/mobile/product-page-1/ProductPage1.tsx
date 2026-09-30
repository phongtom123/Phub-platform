import type { DetailProduct } from "@/data/product-details";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductPurchaseBar } from "./ProductPurchaseBar";
import { CompetitionSection } from "./CompetitionSection";
import { SupportLinksSection } from "./SupportLinksSection";
import { ProductFeatures } from "./ProductFeatures";
import { tridentDesignContent } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function ProductPage1({ product, activeTab }: { product: DetailProduct; activeTab: "about" | "details" | "specs" }) {
  const hasTridentArtwork = product.id === tridentDesignContent.productId;
  return <article className={styles.page}>
    <ProductGallery product={product} />
    <ProductInfo product={product} activeTab={activeTab} />
    <ProductPurchaseBar product={product} />
    {hasTridentArtwork && <CompetitionSection />}
    <SupportLinksSection />
    {hasTridentArtwork && <ProductFeatures />}
    <ServiceBenefits />
  </article>;
}

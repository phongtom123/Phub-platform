import type { DetailProduct } from "@/data/product-details";
import { ProductBreadcrumb } from "@/components/catalog/ProductBreadcrumb";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductPurchaseBar } from "./ProductPurchaseBar";
import { SupportLinksSection } from "./SupportLinksSection";
import styles from "./ProductPage1.module.css";

export function ProductPage1({ product, activeTab }: { product: DetailProduct; activeTab: "about" | "details" | "specs" }) {
  return <article className={styles.page}>
    <ProductBreadcrumb product={product} className={styles.breadcrumb} />
    <ProductGallery product={product} />
    <ProductInfo product={product} activeTab={activeTab} />
    <ProductPurchaseBar product={product} />
    <SupportLinksSection />
    <ServiceBenefits />
  </article>;
}

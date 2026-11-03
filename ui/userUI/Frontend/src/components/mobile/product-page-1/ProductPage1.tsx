import type { DetailProduct } from "@/data/product-details";
import { ProductBreadcrumb } from "@/components/catalog/ProductBreadcrumb";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductPurchaseBar } from "./ProductPurchaseBar";
import { ProductInformation } from "@/components/catalog/ProductInformation";
import type { ProductStock } from "@/lib/catalog/useProductStock";
import { SupportLinksSection } from "./SupportLinksSection";
import styles from "./ProductPage1.module.css";

export function ProductPage1({ product, stock }: { product: DetailProduct; stock: ProductStock }) {
  return <article className={styles.page}>
    <ProductBreadcrumb product={product} className={styles.breadcrumb} />
    <ProductGallery product={product} />
    <ProductInfo product={product} stock={stock} />
    <ProductPurchaseBar product={product} stock={stock} />
    <ProductInformation product={product} />
    <SupportLinksSection productId={product.id} productName={product.name} />
    <ServiceBenefits />
  </article>;
}

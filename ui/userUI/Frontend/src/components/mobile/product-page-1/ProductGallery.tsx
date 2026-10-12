import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";
import { ProductGallery as PublicGallery } from "@/components/catalog/ProductGallery";
export function ProductGallery({ product }: { product: DetailProduct }) {
  return <div className={styles.galleryBlock}><div className={styles.gallery}><PublicGallery product={product} className={styles.galleryImage} width={210} /></div></div>;
}

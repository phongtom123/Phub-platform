import Image from "next/image";
import type { DetailProduct } from "@/data/product-details";
import { tridentDesignContent } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function ProductGallery({ product }: { product: DetailProduct }) {
  const imageSrc = product.id === tridentDesignContent.productId ? tridentDesignContent.image : product.mobileImageSrc ?? product.imageSrc;

  return <div className={styles.galleryBlock}>
    <div className={styles.gallery}>
      <Image className={styles.galleryActions} src="/images/figma-mobile/product-page-1/product-actions.png" alt="" width={31} height={103} aria-hidden="true" />
      {imageSrc && <Image className={styles.galleryImage} src={imageSrc} alt={product.name} width={210} height={210} priority />}
      <span className={styles.gallerySparkle} aria-hidden="true">✧</span>
    </div>
    <div className={styles.zipRow}>
      <Image src="/images/home/zip.svg" alt="Zip" width={77} height={27} />
      <p>Sở hữu ngay, trả góp đến 6 tháng<br />không lãi suất <a href="#product-purchase">Xem thêm</a></p>
    </div>
  </div>;
}

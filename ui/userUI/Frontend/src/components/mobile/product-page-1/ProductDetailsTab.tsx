import type { DetailProduct } from "@/data/product-details";
import { tridentDetailItems } from "./productInfoTabData";
import { tridentDesignContent } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function ProductDetailsTab({ product }: { product: DetailProduct }) {
  const items = product.id === tridentDesignContent.productId
    ? tridentDetailItems
    : product.specifications
      .filter(item => item.value && item.value !== "N/A")
      .map(item => `${item.label}: ${item.value}`);

  if (items.length === 0) return null;

  return <ul className={styles.detailList}>
    {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
  </ul>;
}

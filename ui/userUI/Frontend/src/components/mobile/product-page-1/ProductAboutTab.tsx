import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductAboutTab({ product }: { product: DetailProduct }) {
  return <p className={styles.summary} style={{ whiteSpace: "pre-line" }}>{product.description || "Chưa có mô tả sản phẩm."}</p>;
}

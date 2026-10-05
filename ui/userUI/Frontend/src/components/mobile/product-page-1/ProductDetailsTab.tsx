import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductDetailsTab({ product }: { product: DetailProduct }) {
  return <ul className={styles.detailList}>
    <li>Loại sản phẩm: {product.category}</li>
    {product.brand && <li>Thương hiệu: {product.brand}</li>}
    <li>Đơn vị: {product.unit}</li>
    <li>Bảo hành: {product.warrantyMonths} tháng</li>
  </ul>;
}

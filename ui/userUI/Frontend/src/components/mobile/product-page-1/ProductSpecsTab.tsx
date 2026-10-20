import { SpecsTable } from "@/components/common/SpecsTable";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductPage1.module.css";

export function ProductSpecsTab({ product }: { product: DetailProduct }) {
  const rows = product.specifications;

  if (rows.length === 0) return <p>Chưa có thông số kỹ thuật.</p>;

  return <SpecsTable rows={rows} caption="Thông số sản phẩm" className={styles.specsTable} />;
}

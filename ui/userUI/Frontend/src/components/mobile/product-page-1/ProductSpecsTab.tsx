import { SpecsTable } from "@/components/common/SpecsTable";
import type { DetailProduct } from "@/data/product-details";
import { tridentSpecRows } from "./productInfoTabData";
import { tridentDesignContent } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function ProductSpecsTab({ product }: { product: DetailProduct }) {
  const rows = product.source !== "api" && product.id === tridentDesignContent.productId ? tridentSpecRows : product.specifications;

  if (rows.length === 0) return <p>Chưa có thông số kỹ thuật.</p>;

  return <SpecsTable rows={rows} caption="Thông số sản phẩm" className={styles.specsTable} />;
}

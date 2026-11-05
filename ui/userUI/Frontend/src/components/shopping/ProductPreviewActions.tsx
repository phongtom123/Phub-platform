"use client";
import Link from "next/link";
import { productHref } from "@/lib/catalog/types";
import { ProductCardActions } from "./ProductCardActions";
import styles from "./ProductPreviewActions.module.css";

export function ProductPreviewActions({ product, onClose }: {
  product: { id: string; sku?: string; isActive?: boolean }; onClose: () => void;
}) {
  return <div className={styles.actions}>
    <Link href={productHref(product.id)} onClick={onClose}>Xem chi tiết sản phẩm</Link>
    <ProductCardActions product={product} />
  </div>;
}

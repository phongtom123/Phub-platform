"use client";
import Link from "next/link";
import { productHref } from "@/lib/catalog/types";
import { AddToCartButton } from "./AddToCartButton";
import styles from "./ProductPreviewActions.module.css";

export function ProductPreviewActions({ product, onClose }: {
  product: { id: string; sku?: string }; onClose: () => void;
}) {
  return <div className={styles.actions}>
    <Link href={productHref(product.id)} onClick={onClose}>Xem chi tiết sản phẩm</Link>
    <AddToCartButton product={product} label="Thêm vào giỏ hàng" className={styles.add}/>
  </div>;
}

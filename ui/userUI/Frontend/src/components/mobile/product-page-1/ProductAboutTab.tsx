"use client";

import { useState } from "react";
import { ColorSwatch } from "@/components/common/ColorSwatch";
import type { DetailProduct } from "@/data/product-details";
import { productPage1Colors, tridentDesignContent } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function ProductAboutTab({ product }: { product: DetailProduct }) {
  const [color, setColor] = useState<string>(productPage1Colors[0].id);

  if (product.id !== tridentDesignContent.productId) return null;

  return <>
    <p className={styles.summary}>{tridentDesignContent.summary}</p>
    <div className={styles.swatches} role="radiogroup" aria-label="Màu sản phẩm">
      {productPage1Colors.map(option => <ColorSwatch
        key={option.id}
        name="product-page-1-color"
        label={option.label}
        color={option.color}
        checked={color === option.id}
        onChange={() => setColor(option.id)}
      />)}
    </div>
  </>;
}

"use client";

import { useState } from "react";
import type { DetailProduct } from "@/data/product-details";
import { CatalogImage } from "@/components/common/CatalogImage";
import { placeholderImage } from "@/lib/catalog/types";

export function ProductGallery({ product, className, width = 520 }: { product: DetailProduct; className?: string; width?: number }) {
  const [index, setIndex] = useState(0);
  const images = product.images?.length ? product.images : [{ url: product.imageSrc || placeholderImage, alt: product.name }];
  const active = images[index] ?? images[0];
  return <div style={{ width: "100%", minWidth: 0, textAlign: "center" }}>
    <CatalogImage className={className} src={active.url} alt={active.alt || product.name} width={width} height={width} priority style={{ maxWidth: "100%", objectFit: "contain", marginInline: "auto" }} />
    {images.length > 1 && <div aria-label="Hình ảnh sản phẩm" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
      {images.map((image, position) => <button type="button" key={`${position}-${image.url}`} aria-label={`Xem ảnh ${position + 1}`} aria-pressed={position === index} onClick={() => setIndex(position)}>
        <CatalogImage src={image.url} alt="" width={48} height={48} />
      </button>)}
    </div>}
  </div>;
}

"use client";

import { useRef, useState, type PointerEvent } from "react";
import { preload } from "react-dom";
import { getImageProps } from "next/image";
import type { DetailProduct } from "@/data/product-details";
import { CatalogImage } from "@/components/common/CatalogImage";
import { placeholderImage, safeImageUrl } from "@/lib/catalog/types";
import { isSvgUrl } from "@/lib/media";
import styles from "./ProductGallery.module.css";

// Keep the responsive source set identical before and after mobile hydration.
const galleryImageSizes = "(max-width: 760px) 210px, 410px";

export function ProductGallery({ product, className, width = 520 }: { product: DetailProduct; className?: string; width?: number }) {
  const [selection, setSelection] = useState({ productId: product.id, index: 0 });
  const swipeStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const images = product.images?.length ? product.images : [{ url: product.imageSrc || placeholderImage, alt: product.name }];
  const index = selection.productId === product.id && selection.index < images.length ? selection.index : 0;
  const active = images[index];
  const selectImage = (position: number) => setSelection({ productId: product.id, index: position });
  const moveImage = (direction: number) => selectImage((index + direction + images.length) % images.length);

  // Preload the same optimized URLs used by the main image, not thumbnail URLs.
  // React emits these hints in the initial HTML, before any gallery interaction.
  images.forEach((image, position) => {
    const src = safeImageUrl(image.url);
    const { props } = getImageProps({
      src,
      alt: image.alt || product.name,
      width,
      height: width,
      sizes: galleryImageSizes,
      unoptimized: isSvgUrl(src),
    });
    preload(props.src, {
      as: "image",
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
      fetchPriority: position === 0 ? "high" : "low",
    });
  });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (images.length < 2 || !event.isPrimary || event.pointerType === "mouse") return;
    swipeStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) moveImage(dx < 0 ? 1 : -1);
  };

  return <section className={styles.gallery} aria-label="Thư viện ảnh sản phẩm">
    <div
      className={styles.stage}
      role="group"
      aria-label="Ảnh sản phẩm"
      tabIndex={images.length > 1 ? 0 : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { swipeStart.current = null; }}
      onKeyDown={(event) => {
        if (images.length < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        moveImage(event.key === "ArrowRight" ? 1 : -1);
      }}
    >
      <CatalogImage
        className={[styles.image, className].filter(Boolean).join(" ")}
        src={active.url}
        alt={active.alt || product.name}
        width={width}
        height={width}
        sizes={galleryImageSizes}
        draggable={false}
        loading="eager"
        fetchPriority="high"
      />
      {images.length > 1 && <>
        <button
          type="button"
          className={[styles.arrow, styles.previous].join(" ")}
          aria-label="Ảnh trước"
          onClick={() => moveImage(-1)}
        ><span aria-hidden="true">‹</span></button>
        <button
          type="button"
          className={[styles.arrow, styles.next].join(" ")}
          aria-label="Ảnh tiếp theo"
          onClick={() => moveImage(1)}
        ><span aria-hidden="true">›</span></button>
      </>}
    </div>
    {images.length > 1 && <>
      <p className={styles.counter} aria-live="polite" aria-atomic="true">Ảnh {index + 1} / {images.length}</p>
      <p className={styles.swipeHint}>Vuốt sang trái hoặc phải để chuyển ảnh</p>
      <div className={styles.thumbnails} role="group" aria-label="Chọn ảnh sản phẩm">
        {images.map((image, position) => <button
          type="button"
          key={`${position}-${image.url}`}
          className={styles.thumbnail}
          aria-label={`Xem ảnh ${position + 1}`}
          aria-pressed={position === index}
          onClick={() => selectImage(position)}
        >
          <CatalogImage
            className={styles.thumbnailImage}
            src={image.url}
            alt=""
            width={80}
            height={80}
            sizes="(max-width: 760px) 64px, 80px"
            loading="eager"
            fetchPriority="low"
          />
        </button>)}
      </div>
    </>}
  </section>;
}

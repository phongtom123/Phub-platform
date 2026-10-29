"use client";

import { useEffect, useState } from "react";
import { galleryRequest, type ProductGallery } from "../../lib/product-gallery";
import { useAdminPolling } from "../../lib/use-admin-polling";
import { sameAdminData } from "../../lib/admin-fetch";
import { ProductImagePreview } from "./product-image-preview";
import styles from "./product-gallery.module.css";

export function ProductGalleryPreview({ productId, legacyUrl, name }: { productId: string; legacyUrl: string; name: string }) {
  const [gallery, setGallery] = useState<ProductGallery | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    galleryRequest(productId, controller.signal).then(value => { if (!controller.signal.aborted) setGallery(value); })
      .catch(reason => { if (!controller.signal.aborted) setError((reason as Error).message); });
    return () => controller.abort();
  }, [productId, version]);
  const pollError = useAdminPolling(`product-gallery:${productId}:${version}`, Boolean(gallery) && !error, async (signal, canApply) => {
    const value = await galleryRequest(productId, signal);
    if (canApply()) setGallery(current => sameAdminData(current, value) ? current : value);
  });
  const images = gallery?.images ?? [];
  const active = images.find(image => image.media_id === selected) ?? images[0];
  const source = active?.url ?? gallery?.legacy_url ?? legacyUrl;
  return <div className={styles.preview}>
    <ProductImagePreview key={source} url={source} name={name} />
    {!gallery && !error && <p role="status">Đang tải gallery…</p>}
    {(error || pollError) && <p className="live-error" role="alert">{error || pollError} <button type="button" onClick={() => setVersion(value => value + 1)}>Tải lại gallery</button></p>}
    {images.length > 0 && <div className={styles.thumbs} aria-label="Các ảnh sản phẩm">{images.map((image, index) => <button type="button" key={image.media_id}
      aria-label={`Xem ảnh ${index + 1}${image.primary ? " (ảnh chính)" : ""}`} aria-pressed={active?.media_id === image.media_id} onClick={() => setSelected(image.media_id)}>
      <img src={image.url} alt={image.alt_text || `Ảnh ${index + 1}`} />
    </button>)}</div>}
  </div>;
}

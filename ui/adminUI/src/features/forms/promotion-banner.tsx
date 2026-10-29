"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { readMediaImage, uploadMediaImage } from "@/src/lib/media-upload";
import { ProductImagePreview } from "./product-image-preview";
import styles from "./promotion-banner.module.css";

export type BannerEditorHandle = { prepare: (signal: AbortSignal) => Promise<string | null> };

// Media URLs are immutable. Resolve again only when the promotion's pointer changes.
function useBanner(mediaId: string) {
  const [version, setVersion] = useState(0);
  const [image, setImage] = useState({ id: "", url: "", error: "", loading: false });
  useEffect(() => {
    if (!mediaId) return;
    const controller = new AbortController();
    setImage({ id: mediaId, url: "", error: "", loading: true });
    readMediaImage(mediaId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setImage({ id: mediaId, url: result.url, error: "", loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setImage({ id: mediaId, url: "", error: error instanceof Error ? error.message : "Không đọc được banner.", loading: false }); });
    return () => controller.abort();
  }, [mediaId, version]);
  return { ...(image.id === mediaId ? image : { url: "", error: "", loading: Boolean(mediaId) }), retry: () => setVersion(v => v + 1) };
}

export const PromotionBannerEditor = forwardRef<BannerEditorHandle, {
  value: string; disabled: boolean; onChange: (id: string) => void; onDirty: (dirty: boolean) => void;
}>(function PromotionBannerEditor({ value, disabled, onChange, onDirty }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [uploaded, setUploaded] = useState<{ media_id: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const remote = useBanner(uploaded?.media_id === value ? "" : value);
  useEffect(() => {
    if (!file) { setBlobUrl(""); return; }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useImperativeHandle(ref, () => ({
    async prepare(signal) {
      if (!file) return uploaded?.media_id ?? (value || null);
      const result = await uploadMediaImage(file, signal, "promotion_banner");
      if (signal.aborted) throw new DOMException("Đã hủy", "AbortError");
      // Keep the registered media on a failed promotion save; retry must not upload twice.
      setUploaded(result); setFile(null); onChange(result.media_id);
      return result.media_id;
    },
  }), [file, value, uploaded, onChange]);
  function choose(files: FileList | null) {
    if (disabled || !files?.length) return;
    if (files.length !== 1) { setError("Mỗi chương trình chỉ có một banner. Hãy chọn đúng một ảnh."); return; }
    const next = files[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size > 5 * 1024 * 1024) {
      setError("Chỉ hỗ trợ JPG, PNG, WebP tối đa 5 MB."); return;
    }
    setError(""); setFile(next); setUploaded(null); onDirty(true);
  }
  const source = file ? blobUrl : uploaded?.media_id === value ? uploaded.url : remote.url;
  return <section className={styles.editor} aria-label="Banner khuyến mãi">
    <h3>Banner khuyến mãi</h3>
    <div className={styles.dropzone} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files); }}>
      {source ? <img className={styles.preview} src={source} alt="Xem trước banner khuyến mãi" onError={() => setError("Không tải được ảnh xem trước. Hãy thử chọn lại ảnh.")} />
        : <p>{!file && remote.loading ? "Đang tải banner…" : "Kéo thả một ảnh vào đây hoặc chọn ảnh bên dưới."}</p>}
    </div>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
      aria-label="Chọn banner khuyến mãi" onChange={event => { choose(event.target.files); event.target.value = ""; }} />
    <div className={styles.controls}>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()}>{file || value ? "Thay banner" : "Chọn banner"}</button>
      {(file || value) && <button type="button" disabled={disabled} onClick={() => { setFile(null); setUploaded(null); setError(""); onChange(""); onDirty(true); }}>Gỡ banner</button>}
      {!file && remote.error && <button type="button" disabled={disabled} onClick={remote.retry}>Tải lại banner</button>}
    </div>
    {(error || (!file && remote.error)) && <p role="alert" className="live-error">{error || remote.error}</p>}
    <p className={styles.hint}>Một ảnh JPG, PNG hoặc WebP, tối đa 5 MB và 4096 × 4096 pixel. Gợi ý ảnh ngang 16:5; không cắt hay kéo méo ảnh.</p>
    <p className={styles.hint}>Banner chỉ được áp dụng khi lưu dữ liệu. Thay hoặc gỡ banner không xóa file trên Storage.</p>
  </section>;
});

export function PromotionBannerPreview({ mediaId, name }: { mediaId: string; name: string }) {
  const remote = useBanner(mediaId);
  return <div className={styles.detail}>
    {remote.loading ? <p role="status">Đang tải banner…</p> : remote.error ? <p className="live-error" role="alert">{remote.error} <button type="button" onClick={remote.retry}>Thử lại</button></p>
      : <ProductImagePreview variant="banner" url={remote.url} name={name} />}
  </div>;
}

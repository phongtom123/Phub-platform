"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { galleryRequest, MAX_PRODUCT_IMAGES, moveGalleryImage, validateGalleryFiles, type ProductGallery } from "../../lib/product-gallery";
import { uploadMediaImage } from "../../lib/media-upload";
import styles from "./product-gallery.module.css";

type DraftImage = { key: string; url: string; media_id?: string; file?: File };
export type GalleryEditorHandle = { save: (productId: string, signal: AbortSignal) => Promise<ProductGallery> };
type Props = { productId?: string; disabled: boolean; onDirty: (dirty: boolean) => void; onReady: (ready: boolean) => void };
const fromGallery = (gallery: ProductGallery): DraftImage[] => gallery.images.length
  ? gallery.images.map(image => ({ key: image.media_id, media_id: image.media_id, url: image.url }))
  : gallery.legacy_url ? [{ key: "legacy", url: gallery.legacy_url }] : [];

export const ProductGalleryEditor = forwardRef<GalleryEditorHandle, Props>(function ProductGalleryEditor({ productId, disabled, onDirty, onReady }, ref) {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [ready, setReady] = useState(!productId);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState(0);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const loadedFor = useRef<string | undefined>(undefined);
  const snapshot = useRef<ProductGallery>({ product_id: "", legacy_url: null, images: [] });
  const draft = useRef<DraftImage[]>([]);
  const objectUrls = useRef(new Set<string>());
  const changed = useRef(false);
  useEffect(() => () => { objectUrls.current.forEach(value => URL.revokeObjectURL(value)); }, []);
  useEffect(() => { onReady(ready); }, [ready, onReady]);
  useEffect(() => {
    if (loadedFor.current === productId && productId) return;
    if (!productId) { setReady(true); return; }
    const controller = new AbortController();
    setReady(false); setError("");
    galleryRequest(productId, controller.signal).then(gallery => {
      if (controller.signal.aborted) return;
      snapshot.current = gallery; loadedFor.current = productId;
      objectUrls.current.forEach(value => URL.revokeObjectURL(value)); objectUrls.current.clear();
      draft.current = fromGallery(gallery); setImages(draft.current); changed.current = false; onDirty(false); setReady(true);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được ảnh."); });
    return () => controller.abort();
  }, [productId, version, onDirty]);

  function update(next: DraftImage[]) {
    draft.current = next; setImages(next); changed.current = true; onDirty(true); setError("");
  }
  function select(files: File[]) {
    if (disabled || !ready || !files.length) return;
    try {
      validateGalleryFiles(files, draft.current.length);
      update([...draft.current, ...files.map(file => {
        const preview = URL.createObjectURL(file); objectUrls.current.add(preview);
        return { key: crypto.randomUUID(), file, url: preview };
      })]);
    } catch (reason) { setError((reason as Error).message); }
  }
  function addUrl() {
    const value = url.trim();
    if (!/^(https?:\/\/|\/(?!\/))/.test(value) || /[\\\x00-\x1f]/.test(value) || value.length > 2000) { setError("Nhập URL http/https hoặc đường dẫn /images/… hợp lệ."); return; }
    if (draft.current.length >= MAX_PRODUCT_IMAGES || draft.current.some(image => image.url === value)) { setError("Ảnh bị trùng hoặc gallery đã đủ 20 ảnh."); return; }
    update([...draft.current, { key: crypto.randomUUID(), url: value }]); setUrl("");
  }
  function reload() {
    if (changed.current && !window.confirm("Bỏ các thay đổi ảnh chưa lưu và tải lại gallery?")) return;
    loadedFor.current = undefined; setVersion(value => value + 1);
  }

  useImperativeHandle(ref, () => ({ save: async (id, signal) => {
    if (!ready) throw new Error("Chưa tải được gallery. Hãy thử tải lại ảnh trước khi lưu.");
    // Creating the product changes productId while this save is in flight: do not
    // refetch/remount and overwrite the pending gallery on that transition.
    loadedFor.current = id;
    if (!changed.current) return snapshot.current;
    for (let index = 0; index < draft.current.length; index++) {
      const image = draft.current[index];
      if (!image.file) continue;
      setProgress(`Đang tải ảnh ${index + 1}/${draft.current.length}…`);
      const uploaded = await uploadMediaImage(image.file, signal);
      if (signal.aborted) throw new DOMException("Đã hủy lưu ảnh.", "AbortError");
      // Retain completed uploads on partial failure: retry never reuploads them.
      draft.current = draft.current.map(item => item.key === image.key ? { key: image.key, media_id: uploaded.media_id, url: uploaded.url } : item);
      URL.revokeObjectURL(image.url); objectUrls.current.delete(image.url); setImages(draft.current);
    }
    setProgress("Đang lưu gallery…");
    try {
      const gallery = await galleryRequest(id, signal, { base: snapshot.current, items: draft.current.map(image => image.media_id ? { media_id: image.media_id } : { url: image.url }) });
      if (signal.aborted) throw new DOMException("Đã hủy lưu ảnh.", "AbortError");
      snapshot.current = gallery; draft.current = fromGallery(gallery); setImages(draft.current);
      changed.current = false; onDirty(false); setError(""); return gallery;
    } finally { setProgress(""); }
  } }), [ready, onDirty]);

  return <section className={styles.editor} aria-label="Gallery sản phẩm">
    <header><h3>Hình ảnh sản phẩm ({images.length}/{MAX_PRODUCT_IMAGES})</h3><p>Ảnh đầu tiên là ảnh chính. Các thay đổi chỉ được lưu khi bấm Lưu dữ liệu.</p>
      {productId && <button type="button" disabled={disabled} onClick={reload}>Tải lại gallery</button>}</header>
    {error && <p className="live-error" role="alert">{error}</p>}
    {!ready ? <div><p role="status">Gallery chưa sẵn sàng.</p></div> : <>
      <div className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}>
        <ImagePlus aria-hidden="true" /><p>Kéo thả nhiều ảnh vào đây</p>
        <button type="button" disabled={disabled || images.length >= MAX_PRODUCT_IMAGES} onClick={() => input.current?.click()}>Chọn hình ảnh</button>
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className={styles.fileInput} disabled={disabled} aria-label="Chọn nhiều ảnh sản phẩm"
          onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <small>JPG, PNG, WebP tĩnh · tối đa 5 MB/ảnh, 4096 × 4096 pixel.</small>
      </div>
      <div className={styles.urlInput}><label>Thêm ảnh bằng URL<input value={url} disabled={disabled} placeholder="https://… hoặc /images/…" onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addUrl(); } }} /></label>
        <button type="button" disabled={disabled || !url.trim()} onClick={addUrl}>Thêm ảnh</button></div>
      <div className={styles.grid}>{images.map((image, index) => <article className={styles.imageCard} key={image.key}>
        <Thumbnail url={image.url} index={index} />
        <p>{index === 0 ? "Ảnh chính" : `Ảnh ${index + 1}`}{image.file ? " · Chưa tải lên" : ""}</p>
        <div className={styles.actions}>
          <button type="button" disabled={disabled || index === 0} aria-label={`Đặt ảnh ${index + 1} làm ảnh chính`} onClick={() => update(moveGalleryImage(draft.current, index, 0))}><Star size={16} />Ảnh chính</button>
          <button type="button" disabled={disabled || index === 0} aria-label={`Đưa ảnh ${index + 1} lên trước`} onClick={() => update(moveGalleryImage(draft.current, index, index - 1))}><ArrowLeft size={16} /></button>
          <button type="button" disabled={disabled || index === images.length - 1} aria-label={`Đưa ảnh ${index + 1} ra sau`} onClick={() => update(moveGalleryImage(draft.current, index, index + 1))}><ArrowRight size={16} /></button>
          <button type="button" disabled={disabled} aria-label={`Gỡ ảnh ${index + 1}`} onClick={() => { if (image.file) { URL.revokeObjectURL(image.url); objectUrls.current.delete(image.url); } update(draft.current.filter(item => item.key !== image.key)); }}><Trash2 size={16} /></button>
        </div>
      </article>)}</div>
      {!images.length && <p>Sản phẩm chưa có ảnh.</p>}
      <small>Gỡ ảnh chỉ bỏ liên kết sản phẩm; không xóa file trên Storage.</small>
    </>}
    {progress && disabled && <p role="status">{progress}</p>}
  </section>;
});

function Thumbnail({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return /^(https?:\/\/|\/(?!\/)|blob:)/.test(url) && !failed
    ? <img className={styles.thumbnail} src={url} alt={`Ảnh sản phẩm ${index + 1}`} onError={() => setFailed(true)} />
    : <div className={styles.thumbnail}>Không tải được ảnh</div>;
}

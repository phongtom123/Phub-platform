"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { logLocalImageFailure } from "@/src/lib/local-diagnostics";

export function ProductImagePreview({ url, name, variant = "product" }: { url: string; name: string; variant?: "product" | "banner" }) {
  const heading = variant === "banner" ? "Banner khuyến mãi" : "Hình ảnh sản phẩm";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const viewer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const showImage = () => { viewer.current?.showModal(); setOpen(true); };
  const source = url.trim();
  const failed = failedSource === source;
  const safe = /^(https?:\/\/|\/(?!\/))/.test(source);
  return <section className="product-image-card" aria-label={heading}>
    <h3>{heading}</h3>
    {safe && !failed ? <>
      <button type="button" className="product-image-thumb" style={variant === "banner" ? { aspectRatio: "16 / 5", maxWidth: "none" } : undefined} aria-label={`Phóng to ảnh ${name}`} onClick={showImage}>
        <img key={`${source}:${attempt}`} src={source} alt={variant === "banner" ? `Banner ${name}` : `Ảnh sản phẩm ${name}`} onError={() => {
          setFailedSource(source); logLocalImageFailure(source, "preview");
        }} />
      </button>
      <button type="button" className="product-image-open" aria-haspopup="dialog" onClick={showImage}>Xem ảnh gốc</button>
    </> : <div className="product-image-placeholder">
      <ImageIcon aria-hidden="true" />
      <p>{variant === "banner" ? (source ? "Không tải được banner." : "Chương trình chưa có banner.") : (source ? "Không tải được ảnh sản phẩm." : "Sản phẩm chưa có hình ảnh.")}</p>
      {safe && <button type="button" onClick={() => { setFailedSource(null); setAttempt(value => value + 1); }}>Thử tải lại ảnh</button>}
    </div>}
    <dialog ref={viewer} className="product-image-viewer" aria-label={`Ảnh gốc ${name}`} onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.current?.close();
      }}>
      <header><h3>{name || heading}</h3><button type="button" aria-label="Đóng ảnh" onClick={() => viewer.current?.close()}><X aria-hidden="true" /></button></header>
      {open && safe && <div className="product-image-viewer-body"><img src={source} alt={`Ảnh gốc ${name}`} onError={() => logLocalImageFailure(source, "viewer")} /></div>}
    </dialog>
  </section>;
}

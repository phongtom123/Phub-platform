"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";

export function ProductImagePreview({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
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
  const safe = /^(https?:\/\/|\/(?!\/))/.test(source);
  return <section className="product-image-card" aria-label="Hình ảnh sản phẩm">
    <h3>Hình ảnh sản phẩm</h3>
    {safe && !failed ? <>
      <button type="button" className="product-image-thumb" aria-label={`Phóng to ảnh ${name}`} onClick={showImage}>
        <img key={attempt} src={source} alt={`Ảnh sản phẩm ${name}`} onError={() => setFailed(true)} />
      </button>
      <button type="button" className="product-image-open" aria-haspopup="dialog" onClick={showImage}>Xem ảnh gốc</button>
    </> : <div className="product-image-placeholder">
      <ImageIcon aria-hidden="true" />
      <p>{source ? "Không tải được ảnh sản phẩm." : "Sản phẩm chưa có hình ảnh."}</p>
      {safe && <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Thử tải lại ảnh</button>}
    </div>}
    <dialog ref={viewer} className="product-image-viewer" aria-label={`Ảnh gốc ${name}`} onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.current?.close();
      }}>
      <header><h3>{name || "Hình ảnh sản phẩm"}</h3><button type="button" aria-label="Đóng ảnh" onClick={() => viewer.current?.close()}><X aria-hidden="true" /></button></header>
      {open && safe && <div className="product-image-viewer-body"><img src={source} alt={`Ảnh gốc ${name}`} /></div>}
    </dialog>
  </section>;
}

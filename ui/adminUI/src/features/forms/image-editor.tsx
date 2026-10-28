"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { logLocalImageFailure } from "@/src/lib/local-diagnostics";

type Props = {
  inputId: string; value: string; file: File | null;
  onChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ImageEditor({ inputId, value, file, onChange, onFileChange, disabled = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function select(files: FileList | File[] | null) {
    if (disabled || !files?.length) return;
    if (files.length !== 1) { setError("Mỗi sản phẩm chỉ hỗ trợ một ảnh. Hãy chọn một file."); return; }
    const next = files[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."); return;
    }
    if (!next.size || next.size > 5 * 1024 * 1024) {
      setError("Chọn ảnh không rỗng, dung lượng tối đa 5 MB."); return;
    }
    setError(""); onFileChange(next);
  }
  function drop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); setDragging(false);
    select(event.dataTransfer.files);
  }
  const source = preview || value;
  const safeSource = /^(https?:\/\/|\/(?!\/))/.test(source) || (file && source.startsWith("blob:")) ? source : "";
  return <section className="image-editor product-image-editor" aria-label="Hình ảnh sản phẩm">
    <header><div><h3>Hình ảnh sản phẩm</h3><p>Kéo thả hoặc chọn ảnh. Ảnh chỉ tải lên khi bấm Lưu dữ liệu.</p></div>
      {(file || value) && <button type="button" className="image-remove" disabled={disabled} onClick={() => {
        onFileChange(null); onChange(""); setError("");
      }}><Trash2 /> Gỡ ảnh khỏi sản phẩm</button>}
    </header>
    <div className="image-editor-layout">
      <div className={`image-preview image-dropzone ${dragging ? "is-dragging" : ""}`} role="button" tabIndex={disabled ? -1 : 0}
        aria-label="Kéo thả hình ảnh hoặc nhấn để chọn file" aria-disabled={disabled}
        onClick={() => { if (!disabled) input.current?.click(); }}
        onKeyDown={event => { if (!disabled && ["Enter", " "].includes(event.key)) { event.preventDefault(); input.current?.click(); } }}
        onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={drop}>
        {safeSource && failedSource !== safeSource ? <img key={`${safeSource}:${attempt}`} src={safeSource} alt="Xem trước ảnh sản phẩm" onError={() => {
          setFailedSource(safeSource); logLocalImageFailure(safeSource, "editor");
        }} /> : <div><ImageIcon /><b>{safeSource ? "Không tải được ảnh xem trước." : "Kéo thả ảnh vào đây"}</b><span>Nhấn để chọn ảnh khác từ máy</span></div>}
      </div>
      <div className="image-controls">
        <div>
          <input ref={input} id={inputId} className="image-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
            aria-label="Chọn file ảnh sản phẩm" onChange={event => { select(event.target.files); event.target.value = ""; }} />
          <button type="button" className="image-upload-button" disabled={disabled} onClick={() => input.current?.click()}><Upload /> Chọn hình ảnh</button>
          {safeSource && failedSource === safeSource && <button type="button" disabled={disabled} onClick={() => { setFailedSource(null); setAttempt(value => value + 1); }}>Thử tải lại ảnh</button>}
          {file && <p role="status">Đã chọn: {file.name} · Chưa tải lên</p>}
          <p>JPG, PNG, WebP tĩnh · tối đa 5 MB, 4096 × 4096 pixel. Backend chuẩn hóa thành WebP.</p>
        </div>
        <div><label htmlFor={`${inputId}-url`}>Hoặc nhập URL hình ảnh</label>
          <input id={`${inputId}-url`} type="text" inputMode="url" disabled={disabled} value={value}
            placeholder="https://… hoặc /images/…" onChange={event => {
              onFileChange(null); onChange(event.target.value); setError("");
            }} />
          <p>Gỡ/thay ảnh chỉ đổi liên kết sản phẩm, không xóa file cũ trên Storage.</p>
        </div>
        {error && <p role="alert" className="image-error">{error}</p>}
      </div>
    </div>
  </section>;
}

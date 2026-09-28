"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, Link2, Trash2, Upload } from "lucide-react";

type Props = {
  inputId: string;
  title: string;
  description: string;
  initialUrl?: string;
  onChange: () => void;
};

export function ImageEditor({
  inputId,
  title,
  description,
  initialUrl = "",
  onChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn đúng định dạng hình ảnh.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Dung lượng ảnh không được vượt quá 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(String(reader.result));
      setImageUrl("");
      setFileName(file.name);
      setError("");
      onChange();
    };
    reader.readAsDataURL(file);
  };

  const applyImageUrl = () => {
    const normalizedUrl = imageUrl.trim();
    if (!normalizedUrl) {
      setError("Hãy nhập URL ảnh trước khi xem trước.");
      return;
    }

    setPreviewUrl(normalizedUrl);
    setFileName("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange();
  };

  const removeImage = () => {
    setImageUrl("");
    setPreviewUrl("");
    setFileName("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange();
  };

  return (
    <section className="image-editor">
      <header>
        <div>
          <span>HÌNH ẢNH</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {previewUrl && (
          <button type="button" className="image-remove" onClick={removeImage}>
            <Trash2 /> Xóa ảnh
          </button>
        )}
      </header>

      <div className="image-editor-layout">
        <div className={`image-preview ${previewUrl && !error ? "has-image" : ""}`}>
          {previewUrl && !error ? (
            <img
              src={previewUrl}
              alt={`Xem trước ${title.toLowerCase()}`}
              onError={() => setError("Không thể tải ảnh từ URL này.")}
            />
          ) : (
            <div>
              <ImageIcon />
              <b>Chưa có ảnh</b>
              <span>Ảnh xem trước sẽ hiển thị tại đây</span>
            </div>
          )}
        </div>

        <div className="image-controls">
          <div>
            <label htmlFor={inputId}>Tải ảnh từ máy</label>
            <p>Hỗ trợ JPG, PNG hoặc WebP, dung lượng tối đa 5 MB.</p>
            <input
              ref={fileInputRef}
              id={inputId}
              className="image-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseFile}
            />
            <label className="image-upload-button" htmlFor={inputId}>
              <Upload /> Chọn hình ảnh
            </label>
            {fileName && <strong className="image-file-name">{fileName}</strong>}
          </div>

          <div className="image-url-control">
            <label htmlFor={`${inputId}-url`}>Hoặc sử dụng URL ảnh</label>
            <div>
              <Link2 />
              <input
                id={`${inputId}-url`}
                name="imageUrl"
                type="url"
                value={imageUrl}
                placeholder="https://example.com/hinh-anh.jpg"
                onChange={(event) => {
                  setImageUrl(event.target.value);
                  setError("");
                }}
              />
              <button type="button" onClick={applyImageUrl}>
                Xem trước
              </button>
            </div>
          </div>

          {error && <p className="image-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}

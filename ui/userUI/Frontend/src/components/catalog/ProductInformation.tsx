"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DetailProduct } from "@/data/product-details";
import styles from "./ProductInformation.module.css";

function ExpandableSection({ id, title, previewHeight, children }: {
  id: string; title: string; previewHeight: number; children: ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setOverflows(element.scrollHeight > previewHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewHeight]);

  function toggle() {
    setExpanded(value => !value);
    if (expanded && section.current && section.current.getBoundingClientRect().top < 0) {
      section.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  return <section ref={section} id={id} className={styles.section} aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>{title}</h2>
    <div id={`${id}-content`} className={styles.preview} data-clipped={!expanded && overflows}
      style={{ maxHeight: expanded ? undefined : previewHeight }}>
      <div ref={content}>{children}</div>
    </div>
    {overflows && <div className={styles.footer}><button type="button" onClick={toggle}
      aria-expanded={expanded} aria-controls={`${id}-content`} aria-label={`${expanded ? "Thu gọn" : "Xem thêm"} ${title.toLocaleLowerCase("vi")}`}>
      {expanded ? "Thu gọn" : "Xem thêm"}
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"
        className={expanded ? styles.up : undefined}><path d="m5 7 5 5 5-5" /></svg>
    </button></div>}
  </section>;
}

/** One set of expandable sections for desktop and mobile; no tab navigation or refetch. */
export function ProductInformation({ product }: { product: DetailProduct }) {
  const general = [
    { label: "Tên sản phẩm", value: product.name },
    ...(product.brand ? [{ label: "Thương hiệu", value: product.brand }] : []),
    { label: "Bảo hành", value: product.warrantyMonths !== undefined ? `${product.warrantyMonths} tháng` : "Chưa có thông tin" },
    { label: "Loại sản phẩm", value: product.subcategory || product.category },
    { label: "SKU", value: product.sku },
    ...(product.unit ? [{ label: "Đơn vị", value: product.unit }] : []),
  ];

  return <div id="product-information" className={styles.layout} key={product.id}>
    <ExpandableSection id="product-description" title="Mô tả sản phẩm" previewHeight={240}>
      <p className={styles.description}>{product.description || "Chưa có mô tả sản phẩm."}</p>
    </ExpandableSection>
    <ExpandableSection id="product-specifications" title="Thông số kỹ thuật" previewHeight={440}>
      <table className={styles.specs}>
        <caption className={styles.srOnly}>Thông số kỹ thuật của {product.name}</caption>
        <tbody>
          <tr><th colSpan={2} className={styles.group}>Thông tin chung</th></tr>
          {general.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}
          {product.specifications.length > 0 && <tr><th colSpan={2} className={styles.group}>Cấu hình chi tiết</th></tr>}
          {product.specifications.map((row, index) => <tr key={`${index}-${row.label}`}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}
        </tbody>
      </table>
      {!product.specifications.length && <p className={styles.empty}>Chưa có thông số cấu hình chi tiết.</p>}
    </ExpandableSection>
  </div>;
}

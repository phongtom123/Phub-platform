"use client";

import { useEffect, useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./product-insights.module.css";

type Tip = { top: number; left: number; maxWidth: number };

/**
 * One-line product name that never widens its column. When the name is cut off, hovering or focusing it shows the
 * full name in a floating box attached to <body> (fixed position), so neither the table nor its scroll area grows.
 */
export function ProductName({ name, onOpen }: { name: string; onOpen: () => void }) {
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) return; // fully visible: nothing to reveal
    const rect = element.getBoundingClientRect();
    setTip({ top: rect.top - 6, left: rect.left - 8, maxWidth: Math.max(240, Math.min(640, window.innerWidth - rect.left - 16)) });
  };

  // The box is fixed to the viewport: hide it as soon as anything scrolls underneath.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, [tip]);

  return (
    <>
      <button type="button" className={`${styles.productButton} ${styles.truncate}`} title="Xem biểu đồ bán hàng của sản phẩm"
        aria-label={name} onMouseEnter={show} onMouseLeave={() => setTip(null)} onFocus={show} onBlur={() => setTip(null)}
        onClick={event => { event.stopPropagation(); onOpen(); }}>
        {name}
      </button>
      {tip && typeof document !== "undefined" && createPortal(
        <div className={styles.nameTip} role="tooltip" style={{ top: tip.top, left: tip.left, maxWidth: tip.maxWidth }}>{name}</div>,
        document.body,
      )}
    </>
  );
}

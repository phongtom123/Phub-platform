"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./order-drawer.module.css";

const WIDTH_KEY = "phub-order-detail-right-width-v1";
const HEIGHT_KEY = "phub-order-workspace-height-v1";
const DEFAULT_WIDTH = 70;
const MIN_WIDTH = 40;
const MAX_WIDTH = 82;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 2400;
const clamp = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

/** Store only the layout preference; order data stays in the session cache. */
export function OrderSplitPane({ detail, list }: { detail: ReactNode; list: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const currentWidth = useRef(DEFAULT_WIDTH);
  const [height, setHeight] = useState<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState(640);
  const [heightDragging, setHeightDragging] = useState(false);
  const currentHeight = useRef<number | null>(null);
  const heightStart = useRef({ y: 0, height: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDTH_KEY);
      const value = saved === null ? DEFAULT_WIDTH : Number(saved);
      if (Number.isFinite(value)) { currentWidth.current = clamp(value); setWidth(clamp(value)); }
      const savedHeight = localStorage.getItem(HEIGHT_KEY);
      if (savedHeight !== null && Number.isFinite(Number(savedHeight))) updateHeight(Number(savedHeight));
    } catch { /* The splitter still works when storage is unavailable. */ }
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => setMeasuredHeight(Math.round(element.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);

  function update(value: number, persist = false) {
    const next = clamp(value);
    currentWidth.current = next;
    setWidth(next);
    if (persist) {
      try { localStorage.setItem(WIDTH_KEY, String(next)); } catch { /* Optional preference. */ }
    }
  }

  function updateHeight(value: number | null, persist = false) {
    const next = value === null ? null : Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value)));
    currentHeight.current = next; setHeight(next);
    if (persist) {
      try {
        if (next === null) localStorage.removeItem(HEIGHT_KEY);
        else localStorage.setItem(HEIGHT_KEY, String(next));
      } catch { /* Optional preference. */ }
    }
  }

  return <div ref={root} id={`${id}-workspace`} className={`${styles.workspace}${dragging ? ` ${styles.resizing}` : heightDragging ? ` ${styles.heightResizing}` : ""}`}
    style={{ "--order-pane-width": `${width}%`, "--order-workspace-height": height === null ? undefined : `${height}px` } as CSSProperties}>
    <section className={styles.listPane} aria-label="Danh sách đơn hàng">{list}</section>
    <div className={styles.splitter} role="separator" tabIndex={0} aria-label="Điều chỉnh độ rộng chi tiết đơn hàng"
      aria-orientation="vertical" aria-controls={id} aria-valuemin={MIN_WIDTH} aria-valuemax={MAX_WIDTH}
      aria-valuenow={Math.round(width)} aria-valuetext={`${Math.round(width)}% chiều rộng`}
      title="Kéo để chỉnh độ rộng. Phím trái/phải để điều chỉnh, nhấp đúp để đặt lại."
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const bounds = root.current?.getBoundingClientRect();
        if (bounds?.width) update((bounds.right - event.clientX) / bounds.width * 100);
      }}
      onPointerUp={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false); update(currentWidth.current, true);
      }}
      onLostPointerCapture={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => update(DEFAULT_WIDTH, true)}
      onKeyDown={event => {
        const next = event.key === "ArrowLeft" ? width + 2 : event.key === "ArrowRight" ? width - 2
          : event.key === "Home" ? MIN_WIDTH : event.key === "End" ? MAX_WIDTH : null;
        if (next === null) return;
        event.preventDefault(); update(next, true);
      }}><span aria-hidden="true" /></div>
    <div id={id} className={styles.detailPane}>{detail}</div>
    <div className={styles.heightSplitter} role="separator" tabIndex={0} aria-label="Điều chỉnh chiều cao khung đơn hàng"
      aria-orientation="horizontal" aria-controls={`${id}-workspace`} aria-valuemin={MIN_HEIGHT} aria-valuemax={MAX_HEIGHT}
      aria-valuenow={height ?? measuredHeight} aria-valuetext={`${height ?? measuredHeight} pixel`}
      title="Kéo lên/xuống để chỉnh chiều cao. Nhấp đúp để về chiều cao tự động."
      onPointerDown={event => {
        if (event.button !== 0 || !root.current) return;
        event.preventDefault(); event.currentTarget.focus();
        heightStart.current = { y: event.clientY, height: root.current.getBoundingClientRect().height };
        event.currentTarget.setPointerCapture(event.pointerId); setHeightDragging(true);
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateHeight(heightStart.current.height + event.clientY - heightStart.current.y);
      }}
      onPointerUp={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setHeightDragging(false); updateHeight(currentHeight.current, true);
      }}
      onLostPointerCapture={() => setHeightDragging(false)} onPointerCancel={() => setHeightDragging(false)}
      onDoubleClick={() => updateHeight(null, true)}
      onKeyDown={event => {
        const current = height ?? measuredHeight;
        const next = event.key === "ArrowUp" ? current - 40 : event.key === "ArrowDown" ? current + 40
          : event.key === "Home" ? MIN_HEIGHT : event.key === "End" ? MAX_HEIGHT : null;
        if (next === null) return;
        event.preventDefault(); updateHeight(next, true);
      }}><span aria-hidden="true" /></div>
  </div>;
}

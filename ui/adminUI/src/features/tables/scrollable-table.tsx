"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./scrollable-table.module.css";

/** Keep a second, synchronized scrollbar within reach above tall tables. */
export function ScrollableTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const id = useId();
  const [width, setWidth] = useState({ content: 0, viewport: 0 });
  const overflowing = width.content > width.viewport + 1;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const next = { content: element.scrollWidth, viewport: element.clientWidth };
      setWidth(current => current.content === next.content && current.viewport === next.viewport ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const table = element.querySelector("table");
    if (table) observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (rail.current && viewport.current) rail.current.scrollLeft = viewport.current.scrollLeft;
  }, [width]);

  const sync = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (target && Math.abs(target.scrollLeft - source.scrollLeft) > .5) target.scrollLeft = source.scrollLeft;
  };

  return <div className={styles.root}>
    <div ref={rail} className={styles.rail} hidden={!overflowing} data-table-scrollbar
      tabIndex={0} role="region" aria-label="Cuộn ngang bảng" aria-controls={id} title="Kéo để xem các cột bên phải"
      onScroll={event => sync(event.currentTarget, viewport.current)}
      onKeyDown={event => {
        const element = event.currentTarget;
        const next = event.key === "ArrowRight" ? element.scrollLeft + 80 : event.key === "ArrowLeft" ? element.scrollLeft - 80
          : event.key === "Home" ? 0 : event.key === "End" ? element.scrollWidth : null;
        if (next === null) return;
        event.preventDefault(); element.scrollLeft = next; sync(element, viewport.current);
      }}>
      <div className={styles.track} style={{ width: width.content }} aria-hidden="true" />
    </div>
    <div ref={viewport} id={id} className={`live-table ${className}`} data-table-scroll-viewport
      onScroll={event => sync(event.currentTarget, rail.current)}>{children}</div>
  </div>;
}

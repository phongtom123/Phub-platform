"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./product-insights.module.css";
import { compactVND, formatNumber, shortPeriod } from "./product-insights-data";

export type BarPoint = {
  /** Period key, e.g. "2026-09", "2026-Q3", "2026". */
  period: string;
  /** Full label, e.g. "Tháng 09/2026". */
  label: string;
  value: number;
  /** Every figure for this period, shown in the tooltip and read by screen readers. */
  details: [string, string][];
};

const SERIES = "#14a800";

function niceStep(raw: number, integer: boolean) {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * power).find(candidate => candidate >= raw) ?? 10 * power;
  return integer ? Math.max(1, Math.ceil(step)) : step;
}

/**
 * Single-series bar chart with one y-axis. Every non-zero bar carries its value on top (skipped only
 * when the slot is too narrow for the text); hover/focus a period to read all its figures.
 */
export function BarChart({ points, unit, ariaLabel }: { points: BarPoint[]; unit: "count" | "money"; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // Draw in real pixels so axis text stays legible on narrow screens instead of shrinking with the viewBox.
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = wrap.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...points.map(point => point.value));
  const step = niceStep(max / 4, unit === "count");
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const height = 248, left = 64, right = 12, upper = 26, bottom = 214; // upper leaves room for the tallest bar's value label
  const slot = (width - left - right) / points.length;
  const barWidth = Math.max(4, Math.min(40, slot - 2 - slot * 0.3));
  const labelEvery = Math.max(1, Math.ceil(46 / slot)); // ~46px per axis label avoids collisions
  const y = (amount: number) => bottom - (amount / top) * (bottom - upper);
  const tick = (amount: number) => (unit === "count" ? formatNumber(amount) : compactVND(amount));
  const valueLabel = (amount: number) => (unit === "count" ? formatNumber(amount) : compactVND(Math.round(amount / 1e5) * 1e5));
  const point = active === null ? null : points[active];
  const centre = active === null ? 0 : left + slot * active + slot / 2;

  return (
    <div className={styles.chartWrap} ref={wrap}>
      <svg className={styles.chartSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} onMouseLeave={() => setActive(null)}>
        {ticks.map(value => (
          <g key={value}>
            <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e5e9e2" strokeDasharray={value === 0 ? undefined : "4 5"} />
            <text x={left - 8} y={y(value) + 4} textAnchor="end" className={styles.chartTick}>{tick(value)}</text>
          </g>
        ))}
        {points.map((p, index) => {
          const x = left + slot * index + (slot - barWidth) / 2;
          const barTop = y(p.value);
          const radius = Math.min(4, barWidth / 2, bottom - barTop);
          return (
            <g key={p.period}>
              {p.value > 0 && (
                <path
                  d={`M${x},${bottom} V${barTop + radius} Q${x},${barTop} ${x + radius},${barTop} H${x + barWidth - radius} Q${x + barWidth},${barTop} ${x + barWidth},${barTop + radius} V${bottom} Z`}
                  fill={SERIES} fillOpacity={active === null || active === index ? 1 : 0.45}
                />
              )}
              {p.value > 0 && valueLabel(p.value).length * 6.6 <= slot - 2 && (
                <text x={x + barWidth / 2} y={barTop - 6} textAnchor="middle" className={styles.chartValue}>{valueLabel(p.value)}</text>
              )}
              {(index % labelEvery === 0 || (index === points.length - 1 && (points.length - 1) % labelEvery >= labelEvery / 2)) && (
                <text x={left + slot * index + slot / 2} y={height - 14} textAnchor="middle" className={styles.chartTick}>{shortPeriod(p.period)}</text>
              )}
              <rect x={left + slot * index} y={upper} width={slot} height={bottom - upper} fill="transparent" tabIndex={0}
                aria-label={`${p.label}: ${p.details.map(([name, value]) => `${name} ${value}`).join(", ")}`}
                onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} />
            </g>
          );
        })}
      </svg>
      {point && (
        <div className={styles.chartTooltip} role="status"
          style={{ left: `${(centre / width) * 100}%`, transform: `translateX(${active === 0 ? "-10%" : active === points.length - 1 ? "-90%" : "-50%"})` }}>
          <strong>{point.label}</strong>
          {point.details.map(([name, value]) => <span key={name}>{name}: <b>{value}</b></span>)}
        </div>
      )}
    </div>
  );
}

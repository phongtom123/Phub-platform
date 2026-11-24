"use client";

import styles from "./product-insights.module.css";
import {
  compactVND,
  formatNumber,
  formatVND,
  fourQuarterSlots,
  quarterRange,
  type InvoiceTimelinePoint,
} from "./product-insights-data";

export type QuarterNumber = 1 | 2 | 3 | 4;

export type QuarterRow = {
  quarter: QuarterNumber;
  key: string;
  label: string;
  quantity: number;
  invoices: number;
  revenue: number;
  started: boolean;
};

/** The 4 quarters of a year from the invoice timeline (every non-cancelled order). */
export function quarterRows(timeline: InvoiceTimelinePoint[], year: number): QuarterRow[] {
  return fourQuarterSlots(timeline, year).map(slot => ({
    quarter: slot.quarter,
    key: slot.key,
    label: slot.label,
    quantity: slot.data?.items_sold ?? 0,
    invoices: slot.data?.invoice_count ?? 0,
    revenue: Number(slot.data?.pre_tax ?? 0),
    started: quarterRange(year, slot.quarter) !== null,
  }));
}

const METRICS = [
  { key: "qty", label: "Số lượng bán", gradient: "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)", dot: "#2563eb" },
  { key: "inv", label: "Số hóa đơn", gradient: "linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)", dot: "#7c3aed" },
  { key: "rev", label: "Doanh thu", gradient: "linear-gradient(180deg, #22c55e 0%, #14a800 100%)", dot: "#14a800" },
] as const;

/** Chart view of the quarter table: 4 zones, 3 bars each. Clicking a zone selects that quarter. */
export function QuarterChart({ rows, selected, onSelect, loading }: {
  rows: QuarterRow[];
  selected: QuarterNumber | null;
  onSelect: (quarter: QuarterNumber | null) => void;
  loading: boolean;
}) {
  const max = {
    qty: Math.max(1, ...rows.map(r => r.quantity)),
    inv: Math.max(1, ...rows.map(r => r.invoices)),
    rev: Math.max(1, ...rows.map(r => r.revenue)),
  };
  const height = (value: number, top: number) => (value <= 0 ? 2 : Math.max(8, Math.round((value / top) * 100)));

  return (
    <>
      <div className={styles.groupedLegend} aria-label="Chú thích">
        {METRICS.map(m => (
          <span key={m.key} className={styles.groupedLegendItem}>
            <span className={styles.groupedLegendDot} style={{ backgroundColor: m.dot }} /> {m.label}
          </span>
        ))}
      </div>
      <div className={styles.groupedChartGrid} role="group" aria-label="Biểu đồ cột 4 quý">
        {rows.map(row => {
          const isSelected = selected === row.quarter;
          const isDimmed = selected !== null && !isSelected;
          const bars = [
            { ...METRICS[0], h: height(row.quantity, max.qty), text: formatNumber(row.quantity), full: `${formatNumber(row.quantity)} SP` },
            { ...METRICS[1], h: height(row.invoices, max.inv), text: formatNumber(row.invoices), full: `${formatNumber(row.invoices)} HĐ` },
            { ...METRICS[2], h: height(row.revenue, max.rev), text: compactVND(row.revenue), full: formatVND(row.revenue) },
          ];
          return (
            <button
              key={row.key}
              type="button"
              aria-pressed={isSelected}
              disabled={!row.started}
              className={`${styles.quarterZoneBtn} ${isSelected ? styles.quarterZoneActive : ""} ${isDimmed || !row.started ? styles.quarterZoneDimmed : ""}`}
              onClick={() => onSelect(isSelected ? null : row.quarter)}
              title={row.started ? `${row.label}: ${bars.map(b => `${b.label} ${b.full}`).join(" · ")}` : `${row.label} chưa bắt đầu`}
            >
              <div className={styles.quarterZoneBars}>
                {bars.map(b => (
                  <div key={b.key} className={styles.quarterBarCol}>
                    <span className={styles.quarterBarVal}>{loading ? "…" : b.text}</span>
                    <div className={styles.quarterBarFill} style={{ height: `${loading ? 8 : b.h}%`, background: b.gradient }} />
                  </div>
                ))}
              </div>
              <span className={styles.quarterZoneLabel}>Quý {row.quarter}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.muted} style={{ margin: 0 }}>Mỗi chỉ số có thang đo riêng; cột cao nhất là quý tốt nhất của chỉ số đó.</p>
    </>
  );
}

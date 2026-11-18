"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, PieChart, X } from "lucide-react";
import { PieChartSVG, type ChartSlice } from "../customer-insights/pie-chart-svg";
import { BarChart } from "./bar-chart";
import base from "../customer-insights/customer-insights.module.css";
import styles from "./product-insights.module.css";
import {
  compactVND,
  fetchProductSales,
  formatNumber,
  formatVND,
  type InsightsPeriod,
  type InsightsRange,
  type ProductSalesPoint,
  type ProductSalesReport,
} from "./product-insights-data";

type Metric = "quantity" | "revenue";
export type ChartKind = "bar" | "pie";
// Validated categorical order (7 slots); gray is reserved for the folded "other periods" slice.
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];
const OTHER_COLOR = "#94a3b8";
const PERIOD_LABELS: Record<InsightsPeriod, string> = { month: "tháng", quarter: "quý", year: "năm" };
const SERIES = "#14a800";

function SalesBars({ points, metric }: { points: ProductSalesPoint[]; metric: Metric }) {
  return (
    <BarChart
      unit={metric === "quantity" ? "count" : "money"}
      ariaLabel={`${metric === "quantity" ? "Số lượng bán" : "Doanh thu"} theo kỳ, từ ${points[0].label} đến ${points.at(-1)!.label}`}
      points={points.map(p => ({
        period: p.period, label: p.label, value: metric === "quantity" ? p.quantity : Number(p.revenue),
        details: [["Số lượng", formatNumber(p.quantity)], ["Doanh thu", formatVND(p.revenue)], ["Hóa đơn", formatNumber(p.invoice_count)]],
      }))}
    />
  );
}

/** Share of each period in the total. More than 7 selling periods fold the smallest into "Các kỳ khác". */
function SalesPie({ points, metric }: { points: ProductSalesPoint[]; metric: Metric }) {
  const value = (point: ProductSalesPoint) => (metric === "quantity" ? point.quantity : Number(point.revenue));
  const selling = points.filter(point => value(point) > 0);
  const total = selling.reduce((sum, point) => sum + value(point), 0);
  const kept = selling.length <= PIE_COLORS.length ? selling
    : [...selling].sort((a, b) => value(b) - value(a)).slice(0, PIE_COLORS.length - 1);
  const keptSet = new Set(kept.map(point => point.period));
  const rest = selling.filter(point => !keptSet.has(point.period));
  const share = (amount: number) => (total > 0 ? Math.round((amount / total) * 1000) / 10 : 0);
  const slices: ChartSlice[] = selling.filter(point => keptSet.has(point.period)).map((point, index) => ({
    label: point.label, value: value(point), percentage: share(value(point)), color: PIE_COLORS[index],
  }));
  if (rest.length) {
    const amount = rest.reduce((sum, point) => sum + value(point), 0);
    slices.push({ label: `Các kỳ khác (${rest.length})`, value: amount, percentage: share(amount), color: OTHER_COLOR });
  }
  return (
    <PieChartSVG
      slices={slices}
      size={200}
      centerLabel={metric === "quantity" ? formatNumber(total) : compactVND(total)}
      centerSub={metric === "quantity" ? "sản phẩm" : "doanh thu"}
      emptyText="Không có lượt bán trong các kỳ đã chọn"
    />
  );
}

export function ProductSalesDrawer({ sku, period, range, chartKind, onChartKind, onClose }: {
  sku: string; period: InsightsPeriod; range: InsightsRange; chartKind: ChartKind; onChartKind: (kind: ChartKind) => void; onClose: () => void;
}) {
  const [state, setState] = useState<{ key: string; report: ProductSalesReport | null; error: string | null }>({ key: "", report: null, error: null });
  const [metric, setMetric] = useState<Metric>("quantity");
  const [revision, setRevision] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const key = `${sku}:${period}:${range.start ?? ""}:${range.end ?? ""}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchProductSales(sku, period, { start: range.start, end: range.end }, controller.signal)
      .then(report => { if (!controller.signal.aborted) setState({ key, report, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, report: null, error: error instanceof Error ? error.message : "Không thể tải biểu đồ sản phẩm." }); });
    return () => controller.abort();
  }, [key, sku, period, range.start, range.end]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", escape); opener?.focus?.(); };
  }, [onClose]);

  // Never show the previous product's data while the next one loads.
  const current = state.key === key ? state : { report: null, error: null };
  const report = current.report;
  const s = report?.summary;
  const channelMax = Math.max(1, ...(report?.channels ?? []).map(c => c.quantity));

  return (
    <div className={styles.backdrop} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="product-sales-title">
        <header className={styles.drawerHeader}>
          <div>
            <p>Sản phẩm · {sku}</p>
            <h2 id="product-sales-title">{report?.name ?? "Đang tải…"}</h2>
            {report && (
              <small className={styles.muted}>
                {report.category_name}{report.brand ? ` · ${report.brand}` : ""}
                {report.price !== null ? ` · Giá bán hiện tại ${formatVND(report.price)}` : " · Không còn trong danh mục"}
                {report.status === 2 ? " · Tạm ngưng" : report.status === 0 ? " · Đã ẩn" : ""}
              </small>
            )}
          </div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng biểu đồ sản phẩm"><X aria-hidden="true" /></button>
        </header>

        <div className={styles.drawerBody}>
          {!report && !current.error && <div className={base.stateBox} role="status"><span>Đang tải biểu đồ sản phẩm…</span></div>}
          {current.error && (
            <div className={`${base.stateBox} ${base.errorBox}`} role="alert">
              <span>{current.error}</span>
              <button type="button" className={base.btn} onClick={() => setRevision(value => value + 1)}>Thử lại</button>
            </div>
          )}
          {report && s && (
            <>
              <p className={styles.muted} style={{ margin: 0 }}>
                {range.start ? `Hóa đơn lập từ ${range.start} đến ${range.end}` : "Hóa đơn lập trong toàn bộ thời gian"} · gom theo {PERIOD_LABELS[period]} · đơn chưa hủy
              </p>
              <div className={styles.drawerMetrics}>
                <div><span>Đã bán</span><strong>{formatNumber(s.quantity_sold)}</strong><small>{formatNumber(s.invoice_count)} hóa đơn</small></div>
                <div><span>Doanh thu (chưa thuế)</span><strong>{formatVND(s.revenue)}</strong><small>sau giảm giá</small></div>
                <div><span>Giá bán thực tế TB</span><strong>{formatVND(s.avg_unit_price)}</strong><small>doanh thu / số lượng</small></div>
                <div><span>Tồn khả dụng</span><strong>{formatNumber(s.available_units)}</strong><small>thực tế {formatNumber(s.physical_units)} · đang giữ {formatNumber(s.held_units)}</small></div>
              </div>

              <div className={base.card}>
                <div className={styles.chartHead}>
                  <h3>
                    {chartKind === "pie" ? "Tỷ trọng " : ""}
                    {metric === "quantity" ? (chartKind === "pie" ? "số lượng bán" : "Số lượng bán") : (chartKind === "pie" ? "doanh thu chưa thuế (đ)" : "Doanh thu chưa thuế")} theo {PERIOD_LABELS[period]}
                  </h3>
                  <div className={styles.chartControls}>
                  <div className={base.periodTabs} aria-label="Kiểu biểu đồ">
                    {(["bar", "pie"] as ChartKind[]).map(option => (
                      <button key={option} type="button" aria-pressed={chartKind === option} title={option === "bar" ? "Biểu đồ cột" : "Biểu đồ tròn"}
                        className={`${base.periodTab} ${chartKind === option ? base.periodTabActive : ""}`} onClick={() => onChartKind(option)}>
                        {option === "bar" ? <BarChart3 size={14} aria-hidden="true" /> : <PieChart size={14} aria-hidden="true" />} {option === "bar" ? "Cột" : "Tròn"}
                      </button>
                    ))}
                  </div>
                  <div className={base.periodTabs} aria-label="Chỉ số biểu đồ">
                    {(["quantity", "revenue"] as Metric[]).map(option => (
                      <button key={option} type="button" aria-pressed={metric === option}
                        className={`${base.periodTab} ${metric === option ? base.periodTabActive : ""}`} onClick={() => setMetric(option)}>
                        {option === "quantity" ? "Số lượng" : "Doanh thu"}
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
                {report.timeline.length === 0 ? (
                  <p className={styles.empty}>Sản phẩm chưa có lượt bán trong khoảng thời gian đã chọn.</p>
                ) : (
                  <>
                    {chartKind === "pie" ? <SalesPie points={report.timeline} metric={metric} /> : <SalesBars points={report.timeline} metric={metric} />}
                    <details className={styles.dataDetails}>
                      <summary>Xem số liệu</summary>
                      <table className={base.timelineTable}>
                        <thead><tr><th>Kỳ</th><th className={styles.num}>Số lượng</th><th className={styles.num}>Hóa đơn</th><th className={styles.num}>Doanh thu</th></tr></thead>
                        <tbody>
                          {report.timeline.map(p => (
                            <tr key={p.period}><td>{p.label}</td><td className={styles.num}>{formatNumber(p.quantity)}</td>
                              <td className={styles.num}>{formatNumber(p.invoice_count)}</td><td className={styles.num}>{formatVND(p.revenue)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                )}
              </div>

              <div className={styles.drawerTwoCol}>
                <div className={base.card}>
                  <h3 className={styles.drawerCardTitle}>Theo kênh bán</h3>
                  {report.channels.length === 0 ? <p className={styles.empty}>Chưa có lượt bán.</p> : (
                    <div className={base.progressList}>
                      {report.channels.map(c => (
                        <div className={base.progressItem} key={c.key}>
                          <div className={base.progressInfo}><span>{c.label}</span><strong>{formatNumber(c.quantity)} SP · {formatVND(c.revenue)}</strong></div>
                          <div className={base.progressBarTrack}>
                            <div className={base.progressBarFill} style={{ width: `${(c.quantity / channelMax) * 100}%`, backgroundColor: SERIES }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={base.card}>
                  <h3 className={styles.drawerCardTitle}>Theo kho</h3>
                  {report.warehouses.length === 0 ? <p className={styles.empty}>Chưa có tồn kho trong kho đang hoạt động.</p> : (
                    <div style={{ overflowX: "auto" }}>
                      <table className={base.timelineTable}>
                        <thead><tr><th>Kho</th><th className={styles.num}>Đã bán</th><th className={styles.num}>Đang giữ</th><th className={styles.num}>Khả dụng</th></tr></thead>
                        <tbody>
                          {report.warehouses.map(w => (
                            <tr key={w.warehouse_id}><td>{w.name}</td><td className={styles.num}>{formatNumber(w.quantity_sold)}</td>
                              <td className={styles.num}>{formatNumber(w.held_units)}</td><td className={styles.num}><strong>{formatNumber(w.available_units)}</strong></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

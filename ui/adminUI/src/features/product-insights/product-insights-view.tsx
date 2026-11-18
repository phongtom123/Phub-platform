"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Boxes,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Layers,
  Package,
  RefreshCw,
  Search,
  Tag,
  TrendingUp,
  Wallet,
  Warehouse,
} from "lucide-react";
import { PieChartSVG, type ChartSlice } from "../customer-insights/pie-chart-svg";
import base from "../customer-insights/customer-insights.module.css";
import styles from "./product-insights.module.css";
import {
  PRESET_LABELS,
  fetchAllProducts,
  fetchStockList,
  formatNumber,
  formatVND,
  presetRange,
  type BreakdownItem,
  type InsightsPeriod,
  type InsightsRange,
  type InvoiceTimelinePoint,
  type ProductStockList,
  type StockView,
  type ProductSalesItem,
  type RangePreset,
} from "./product-insights-data";
import { useProductInsights } from "./use-product-insights";
import { ProductSalesDrawer, type ChartKind } from "./product-sales-drawer";
import { StockBadge } from "./stock-badge";
import { BarChart } from "./bar-chart";
import { StockListDrawer } from "./stock-list-drawer";
import { buildProductInsightsWorkbook, productInsightsFileName } from "./product-insights-xlsx";
import { vietnamDay } from "../dashboard/dashboard-data";

const STATUS_COLORS: Record<string, string> = { PAID: "#14a800", PARTIAL: "#f59e0b", UNPAID: "#ef4444", CANCELLED: "#94a3b8" };
const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#64748b"];
const PERIOD_LABELS: Record<InsightsPeriod, string> = { month: "Tháng", quarter: "Quý", year: "Năm" };
type TrendMetric = "total" | "collected" | "invoices" | "items";
const TREND_METRICS: Record<TrendMetric, { tab: string; title: string; unit: "count" | "money"; value: (row: InvoiceTimelinePoint) => number }> = {
  total: { tab: "Tổng sau thuế", title: "Tổng giá trị hóa đơn (sau thuế)", unit: "money", value: row => Number(row.total) },
  collected: { tab: "Đã thu", title: "Số tiền đã thu", unit: "money", value: row => Number(row.collected) },
  invoices: { tab: "Số hóa đơn", title: "Số hóa đơn", unit: "count", value: row => row.invoice_count },
  items: { tab: "SL sản phẩm", title: "Số lượng sản phẩm bán", unit: "count", value: row => row.items_sold },
};

function slices(rows: BreakdownItem[], by: "count" | "amount", colors?: Record<string, string>): ChartSlice[] {
  return rows.map((row, index) => ({
    label: row.label,
    value: by === "count" ? row.count : Number(row.amount),
    percentage: by === "count" ? row.percentage : row.amount_percentage,
    color: colors?.[row.key] ?? PALETTE[index % PALETTE.length],
    subtext: by === "count" ? formatVND(row.amount) : `${formatNumber(row.count)} giao dịch`,
  }));
}

function ProductTable({ rows, threshold, empty, mode, onSelect, ranked = true }: { rows: ProductSalesItem[]; threshold: number; empty: string; mode: "sales" | "stock" | "slow"; onSelect: (sku: string) => void; ranked?: boolean }) {
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className={base.timelineTable}>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            {mode === "sales" && <th className={styles.num}>Đã bán</th>}
            {mode === "sales" && <th className={styles.num}>Doanh thu</th>}
            {mode !== "sales" && <th className={styles.num}>Giá bán</th>}
            {mode === "stock" && <th className={styles.num}>Đã bán</th>}
            {mode === "stock" && <th className={styles.num}>Đang giữ</th>}
            <th className={styles.num}>Tồn khả dụng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku} className={styles.clickableRow} onClick={() => onSelect(row.sku)}>
              <td>
                <button type="button" className={styles.productButton} title="Xem biểu đồ bán hàng của sản phẩm"
                  onClick={event => { event.stopPropagation(); onSelect(row.sku); }}>{row.name}</button>
                <small className={styles.muted}>
                  {mode === "sales" && ranked ? `#${index + 1} · ` : ""}{row.sku} · {row.category_name}{row.brand ? ` · ${row.brand}` : ""}
                </small>
              </td>
              {mode === "sales" && <td className={styles.num}><strong>{formatNumber(row.quantity_sold)}</strong></td>}
              {mode === "sales" && <td className={styles.num}>{formatVND(row.revenue)}</td>}
              {mode !== "sales" && <td className={styles.num}>{formatVND(row.price)}</td>}
              {mode === "stock" && <td className={styles.num}>{formatNumber(row.quantity_sold)}</td>}
              {mode === "stock" && <td className={styles.num}>{formatNumber(row.held_units)}</td>}
              <td className={styles.num}><StockBadge available={row.available_units} threshold={threshold} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, sub, icon, onOpen }: { label: string; value: string; sub: string; icon: React.ReactNode; onOpen?: () => void }) {
  if (onOpen) {
    return (
      <button type="button" className={`${base.metricCard} ${styles.metricButton}`} onClick={onOpen} aria-haspopup="dialog">
        <span className={base.metricHeader}>
          <span>{label}</span>
          <span className={base.metricIcon}>{icon}</span>
        </span>
        <span className={base.metricValue} style={{ display: "block" }}>{value}</span>
        <span className={base.metricSub} style={{ display: "block" }}>{sub}</span>
        <span className={styles.metricHint} style={{ display: "block" }}>Xem chi tiết →</span>
      </button>
    );
  }
  return (
    <div className={base.metricCard}>
      <div className={base.metricHeader}>
        <span>{label}</span>
        <span className={base.metricIcon}>{icon}</span>
      </div>
      <div className={base.metricValue}>{value}</div>
      <div className={base.metricSub}>{sub}</div>
    </div>
  );
}

function CardHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className={base.cardHeader}>
      <div>
        <h3>{icon} {title}</h3>
        <p>{sub}</p>
      </div>
    </div>
  );
}

const SEARCH_LIMIT = 10;

function useBestSellerSearch(text: string, range: InsightsRange) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const key = JSON.stringify([query, range.start, range.end]);
  const [state, setState] = useState<{ key: string; list: ProductStockList | null; error: string | null }>({ key: "", list: null, error: null });
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetchStockList({ view: "sales", status: "ALL", category: null, q: query, page: 1, pageSize: SEARCH_LIMIT }, range, controller.signal)
      .then(list => { if (!controller.signal.aborted) setState({ key, list, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, list: null, error: error instanceof Error ? error.message : "Không tìm được sản phẩm." }); });
    return () => controller.abort();
    // `key` encodes query and range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const settled = state.key === key ? state : { list: null, error: null };
  return { active: text.trim() !== "", pending: text.trim() !== query || (!settled.list && !settled.error), ...settled };
}

export function ProductInsightsView() {
  const [period, setPeriod] = useState<InsightsPeriod>("month");
  const [preset, setPreset] = useState<RangePreset>("all");
  const [range, setRange] = useState<InsightsRange>(() => presetRange("all"));
  const [, startTransition] = useTransition();
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("total");
  const [stockView, setStockView] = useState<Exclude<StockView, "sales"> | null>(null);
  const closeStockList = useCallback(() => setStockView(null), []);
  const [topSearch, setTopSearch] = useState("");
  // A price range or brand chosen below narrows "Theo loại sản phẩm" to that segment.
  const [segment, setSegment] = useState<{ kind: "price" | "brand"; key: string } | null>(null);
  const categoryCard = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  /** Excel export: the library loads only on click; products are the full list for the report's own range. */
  async function exportExcel() {
    if (!report) return;
    setExporting(true);
    setExportError("");
    try {
      const scope = { start: report.range.start, end: report.range.end };
      const [module, products] = await Promise.all([import("exceljs"), fetchAllProducts(scope)]);
      const Excel = ((module as unknown as { default?: typeof module }).default ?? module) as typeof import("exceljs");
      const book = buildProductInsightsWorkbook(Excel, report, products, new Date());
      const blob = new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = productInsightsFileName(report, vietnamDay(new Date()) ?? "hom-nay");
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setExportError(cause instanceof Error ? `Không xuất được file Excel: ${cause.message}` : "Không xuất được file Excel.");
    } finally {
      setExporting(false);
    }
  }
  const chooseSegment = (next: { kind: "price" | "brand"; key: string }) => {
    const same = segment?.kind === next.kind && segment.key === next.key;
    setSegment(same ? null : next);
    if (!same) categoryCard.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const search = useBestSellerSearch(topSearch, range);
  const closeProduct = useCallback(() => setSelectedSku(null), []);
  const { report, loading, error, refresh } = useProductInsights(period, range);

  const choosePreset = (next: RangePreset) => startTransition(() => { setPreset(next); setRange(presetRange(next)); });
  const choosePeriod = (next: InsightsPeriod) => startTransition(() => setPeriod(next));

  const p = report?.product_summary;
  const i = report?.invoice_summary;
  const collectRate = (collected: string, total: string) => Number(total) > 0 ? `${Math.round((Number(collected) / Number(total)) * 1000) / 10}%` : "—";

  return (
    <div className={base.page}>
      <div className={base.heading}>
        <div className={base.headingTitle}>
          <h1><BarChart3 size={26} color="#14a800" /> Thống kê sản phẩm & hóa đơn</h1>
          <p>Theo dõi danh mục, tồn kho khả dụng, sản phẩm bán chạy/bán chậm và tình trạng thu tiền của hóa đơn</p>
        </div>
        <div className={base.headingActions}>
          <button type="button" className={base.btn} onClick={refresh} disabled={loading}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <button
            type="button"
            className={`${base.btn} ${base.btnPrimary}`}
            onClick={() => report && !loading && !error && void exportExcel()}
            disabled={!report || loading || Boolean(error) || exporting}
          >
            <Download size={16} /> {exporting ? "Đang xuất…" : "Xuất Excel"}
          </button>
        </div>
      </div>
      {exportError && <p className={`${base.stateBox} ${base.errorBox}`} role="alert" style={{ marginTop: 0 }}>{exportError}</p>}

      <div className={base.periodCard}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className={base.periodTabs} aria-label="Khoảng thời gian lập hóa đơn">
            {(Object.keys(PRESET_LABELS) as RangePreset[]).map(key => (
              <button key={key} type="button" aria-pressed={preset === key}
                className={`${base.periodTab} ${preset === key ? base.periodTabActive : ""}`} onClick={() => choosePreset(key)}>
                {PRESET_LABELS[key]}
              </button>
            ))}
          </div>
          <div className={base.periodTabs} aria-label="Gom xu hướng theo">
            {(Object.keys(PERIOD_LABELS) as InsightsPeriod[]).map(key => (
              <button key={key} type="button" aria-pressed={period === key}
                className={`${base.periodTab} ${period === key ? base.periodTabActive : ""}`} onClick={() => choosePeriod(key)}>
                Theo {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
        <span className={base.periodNote}>
          {range.start ? `Hóa đơn lập từ ${range.start} đến ${range.end}` : "Hóa đơn lập trong toàn bộ thời gian"} · Tồn kho là số hiện tại
        </span>
      </div>

      {loading ? (
        <div className={base.stateBox}><span>Đang tổng hợp thống kê sản phẩm & hóa đơn…</span></div>
      ) : error ? (
        <div className={`${base.stateBox} ${base.errorBox}`} role="alert"><span>{error}</span></div>
      ) : report && p && i ? (
        <>
          <h2 className={styles.sectionTitle}>Hóa đơn</h2>
          <div className={base.metricsGrid}>
            <Metric label="Tổng hóa đơn" value={formatNumber(i.total_invoices)} icon={<FileText size={18} />}
              sub={`${formatNumber(i.valid_invoices)} hiệu lực · ${formatNumber(i.cancelled_invoices)} thuộc đơn đã hủy`} />
            <Metric label="Tổng giá trị (sau thuế)" value={formatVND(i.total_amount)} icon={<DollarSign size={18} />}
              sub={`Trước thuế ${formatVND(i.pre_tax_amount)} · Thuế ${formatVND(i.tax_amount)}`} />
            <Metric label="Đã thu (trừ hoàn)" value={formatVND(i.collected_amount)} icon={<Wallet size={18} />}
              sub={`Tỷ lệ thu ${collectRate(i.collected_amount, i.total_amount)} · TB ${formatVND(i.avg_invoice_value)}/hóa đơn`} />
            <Metric label="Còn phải thu" value={formatVND(i.outstanding_amount)} icon={<CreditCard size={18} />}
              sub={`${formatNumber(i.unpaid_invoices)} chưa thu · ${formatNumber(i.partial_invoices)} thu một phần`} />
          </div>

          <div className={styles.pieGrid4}>
            <PieChartSVG title="Trạng thái thanh toán" slices={slices(report.invoice_status, "count", STATUS_COLORS)}
              centerLabel={formatNumber(i.total_invoices)} centerSub="hóa đơn" valueUnit="HĐ" emptyText="Chưa có hóa đơn" />
            <PieChartSVG title="Phương thức thanh toán (số tiền thu, đ)" slices={slices(report.payment_methods, "amount")}
              centerLabel={formatNumber(report.payment_methods.reduce((sum, row) => sum + row.count, 0))} centerSub="khoản thu" valueUnit="đ" emptyText="Chưa có khoản thu" />
            <PieChartSVG title="Kênh bán" slices={slices(report.sales_channels, "count")}
              centerLabel={formatNumber(i.valid_invoices)} centerSub="hóa đơn" valueUnit="HĐ" emptyText="Chưa có hóa đơn" />
            <PieChartSVG title="Nguồn lập hóa đơn" slices={slices(report.invoice_sources, "count")}
              centerLabel={formatNumber(i.valid_invoices)} centerSub="hóa đơn" valueUnit="HĐ" emptyText="Chưa có hóa đơn" />
          </div>

          <div className={base.card} style={{ marginBottom: 24 }}>
            <div className={styles.chartHead}>
              <div>
                <h3 className={styles.trendTitle}><TrendingUp size={18} color="#14a800" /> {TREND_METRICS[trendMetric].title} theo {PERIOD_LABELS[period]}</h3>
                <p className={styles.muted} style={{ margin: "4px 0 0" }}>Hóa đơn thuộc đơn chưa hủy</p>
              </div>
              <div className={base.periodTabs} aria-label="Chỉ số xu hướng hóa đơn">
                {(Object.keys(TREND_METRICS) as TrendMetric[]).map(key => (
                  <button key={key} type="button" aria-pressed={trendMetric === key}
                    className={`${base.periodTab} ${trendMetric === key ? base.periodTabActive : ""}`} onClick={() => setTrendMetric(key)}>
                    {TREND_METRICS[key].tab}
                  </button>
                ))}
              </div>
            </div>
            {report.timeline.length === 0 ? (
              <p className={styles.empty}>Chưa có hóa đơn trong khoảng thời gian đã chọn.</p>
            ) : (
              <>
                <BarChart
                  unit={TREND_METRICS[trendMetric].unit}
                  ariaLabel={`${TREND_METRICS[trendMetric].title} theo ${PERIOD_LABELS[period]}, từ ${report.timeline[0].label} đến ${report.timeline.at(-1)!.label}`}
                  points={report.timeline.map(row => ({
                    period: row.period, label: row.label, value: TREND_METRICS[trendMetric].value(row),
                    details: [["Tổng sau thuế", formatVND(row.total)], ["Đã thu", `${formatVND(row.collected)} (${collectRate(row.collected, row.total)})`],
                      ["Hóa đơn", formatNumber(row.invoice_count)], ["SL sản phẩm", formatNumber(row.items_sold)]],
                  }))}
                />
                <details className={styles.dataDetails}>
                  <summary>Xem số liệu</summary>
                  <div style={{ overflowX: "auto" }}>
                    <table className={base.timelineTable}>
                      <thead>
                        <tr>
                          <th>Kỳ</th>
                          <th className={styles.num}>Hóa đơn</th>
                          <th className={styles.num}>SL sản phẩm</th>
                          <th className={styles.num}>Thuế</th>
                          <th className={styles.num}>Đã thu</th>
                          <th className={styles.num}>Tỷ lệ thu</th>
                          <th className={styles.num}>Tổng sau thuế</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.timeline.map(row => (
                          <tr key={row.period}>
                            <td><strong>{row.label}</strong></td>
                            <td className={styles.num}>{formatNumber(row.invoice_count)}</td>
                            <td className={styles.num}>{formatNumber(row.items_sold)}</td>
                            <td className={styles.num}>{formatVND(row.tax)}</td>
                            <td className={styles.num}>{formatVND(row.collected)}</td>
                            <td className={styles.num}>{collectRate(row.collected, row.total)}</td>
                            <td className={styles.num}><strong>{formatVND(row.total)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </div>

          <h2 className={styles.sectionTitle}>Sản phẩm & tồn kho</h2>
          <div className={base.metricsGrid}>
            <Metric label="Sản phẩm đang bán" value={formatNumber(p.active_products)} icon={<Package size={18} />} onOpen={() => setStockView("products")}
              sub={`${formatNumber(p.paused_products)} tạm ngưng · ${formatNumber(p.hidden_products)} đã ẩn · ${formatNumber(p.total_categories)} loại`} />
            <Metric label="Tồn khả dụng" value={formatNumber(p.available_units)} icon={<Warehouse size={18} />} onOpen={() => setStockView("stock")}
              sub={`Thực tế ${formatNumber(p.physical_units)} · đang giữ ${formatNumber(p.held_units)}`} />
            <Metric label="Hết / sắp hết hàng" value={`${formatNumber(p.out_of_stock_products)} / ${formatNumber(p.low_stock_products)}`} icon={<AlertTriangle size={18} />} onOpen={() => setStockView("low")}
              sub={`Sản phẩm đang bán · sắp hết khi còn ≤ ${p.low_stock_threshold}`} />
            <Metric label="Giá trị tồn (giá bán)" value={formatVND(p.inventory_value)} icon={<Boxes size={18} />} onOpen={() => setStockView("value")}
              sub={`${formatNumber(i.items_sold)} sản phẩm đã bán trong kỳ`} />
          </div>

          <div className={base.productInsightsGrid}>
            {(() => {
              // Resolve the chosen segment against the current report (it may vanish after a filter change).
              const price = segment?.kind === "price" ? report.price_ranges.find(row => row.key === segment.key) : undefined;
              const brand = segment?.kind === "brand" ? report.top_brands.find(row => row.brand === segment.key) : undefined;
              const filtered = price ?? brand;
              const rows = filtered ? filtered.categories : report.categories;
              return (
            <div className={`${base.card} ${styles.scrollTarget}`} ref={categoryCard} id="category-breakdown">
              <CardHeader icon={<Layers size={18} color="#14a800" />} title="Theo loại sản phẩm"
                sub={price ? "Sản phẩm đang bán trong khoảng giá đã chọn (theo giá bán hiện tại)" : brand ? "Sản phẩm của thương hiệu đã chọn; doanh thu chưa thuế trong kỳ"
                  : "Tỷ trọng doanh thu chưa thuế trong kỳ và tồn khả dụng hiện tại"} />
              {filtered && (
                <p className={styles.segmentState} role="status">
                  Đang lọc: <strong>{price ? `giá ${price.label}` : `thương hiệu ${brand!.brand}`}</strong>
                  <button type="button" onClick={() => setSegment(null)}>Bỏ lọc</button>
                </p>
              )}
              {rows.length === 0 ? <p className={styles.empty}>{filtered ? "Không có sản phẩm nào trong nhóm này." : "Chưa có loại sản phẩm."}</p> : (
                <div className={base.progressList}>
                  {rows.map(cat => (
                    <div className={base.progressItem} key={cat.category_id}>
                      <div className={base.progressInfo}>
                        <span>{cat.category_name}</span>
                        <strong>{formatVND(cat.revenue)} ({cat.revenue_percentage}%)</strong>
                      </div>
                      <div className={base.progressBarTrack}>
                        <div className={base.progressBarFill} style={{ width: `${Math.min(100, Math.max(cat.revenue_percentage > 0 ? 3 : 0, cat.revenue_percentage))}%`, backgroundColor: "#2980b9" }} />
                      </div>
                      <small className={styles.muted}>
                        {formatNumber(cat.product_count)} SP đang bán · đã bán {formatNumber(cat.quantity_sold)} · tồn {formatNumber(cat.available_units)}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
              );
            })()}

            <div className={base.card}>
              <CardHeader icon={<Award size={18} color="#14a800" />} title="Sản phẩm bán chạy" sub="Xếp theo số lượng trên hóa đơn của đơn chưa hủy trong kỳ · nhấp vào sản phẩm để xem biểu đồ" />
              <label className={`${styles.searchBox} ${styles.cardSearch}`}>
                <Search size={15} aria-hidden="true" />
                <input type="search" value={topSearch} onChange={event => setTopSearch(event.target.value)} maxLength={100}
                  placeholder="Tìm sản phẩm theo tên hoặc SKU…" aria-label="Tìm sản phẩm trong thống kê bán hàng" />
              </label>
              {!search.active ? (
                <ProductTable rows={report.top_products} threshold={p.low_stock_threshold} mode="sales" onSelect={setSelectedSku} empty="Chưa có sản phẩm bán ra trong kỳ." />
              ) : search.error ? (
                <p className={styles.empty} role="alert">{search.error}</p>
              ) : search.pending || !search.list ? (
                <p className={styles.empty} role="status">Đang tìm…</p>
              ) : (
                <>
                  <ProductTable rows={search.list.items} threshold={p.low_stock_threshold} mode="sales" ranked={false} onSelect={setSelectedSku}
                    empty={`Không tìm thấy sản phẩm khớp “${topSearch.trim()}”.`} />
                  {search.list.total > search.list.items.length && (
                    <p className={styles.muted} style={{ margin: "10px 0 0" }}>
                      Hiển thị {formatNumber(search.list.items.length)} / {formatNumber(search.list.total)} kết quả bán chạy nhất · gõ cụ thể hơn để thu hẹp
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={base.twoColGrid}>
            <div className={base.card}>
              <CardHeader icon={<AlertTriangle size={18} color="#d97706" />} title="Hết hàng & sắp hết hàng"
                sub={`Sản phẩm đang bán còn ≤ ${p.low_stock_threshold} tồn khả dụng; ưu tiên mặt hàng bán chạy`} />
              <ProductTable rows={report.low_stock_products} threshold={p.low_stock_threshold} mode="stock" onSelect={setSelectedSku} empty="Không có sản phẩm hết hoặc sắp hết hàng." />
            </div>
            <div className={base.card}>
              <CardHeader icon={<Boxes size={18} color="#64748b" />} title="Tồn kho chưa bán được" sub="Sản phẩm đang bán còn tồn nhưng không có lượt bán trong kỳ, xếp theo giá trị tồn" />
              <ProductTable rows={report.slow_products} threshold={p.low_stock_threshold} mode="slow" onSelect={setSelectedSku} empty="Mọi sản phẩm còn tồn đều đã có lượt bán trong kỳ." />
            </div>
          </div>

          <div className={base.twoColGrid}>
            <div className={base.card}>
              <CardHeader icon={<Tag size={18} color="#14a800" />} title="Phân khúc giá" sub="Phân bố sản phẩm đang bán theo giá bán hiện tại · nhấp để xem theo loại sản phẩm" />
              <div className={base.progressList}>
                {report.price_ranges.map(row => {
                  const selected = segment?.kind === "price" && segment.key === row.key;
                  return (
                  <button type="button" className={`${base.progressItem} ${styles.segmentButton} ${selected ? styles.segmentSelected : ""}`} key={row.key}
                    aria-pressed={selected} aria-controls="category-breakdown" onClick={() => chooseSegment({ kind: "price", key: row.key })}>
                    <span className={base.progressInfo}>
                      <span>{row.label}</span>
                      <strong>{formatNumber(row.count)} SP ({row.percentage}%)</strong>
                    </span>
                    <span className={base.progressBarTrack} style={{ display: "block" }}>
                      <span className={base.progressBarFill} style={{ display: "block", width: `${Math.min(100, row.percentage)}%`, backgroundColor: "#16a085" }} />
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
            <div className={base.card}>
              <CardHeader icon={<Award size={18} color="#14a800" />} title="Thương hiệu" sub="Doanh thu chưa thuế trong kỳ và số sản phẩm đang bán · nhấp để xem theo loại sản phẩm" />
              {report.top_brands.length === 0 ? <p className={styles.empty}>Chưa có dữ liệu thương hiệu.</p> : (
                <div className={base.progressList}>
                  {report.top_brands.map(row => {
                    const selected = segment?.kind === "brand" && segment.key === row.brand;
                    return (
                    <button type="button" className={`${base.progressItem} ${styles.segmentButton} ${selected ? styles.segmentSelected : ""}`} key={row.brand}
                      aria-pressed={selected} aria-controls="category-breakdown" onClick={() => chooseSegment({ kind: "brand", key: row.brand })}>
                      <span className={base.progressInfo}>
                        <span>{row.brand}</span>
                        <strong>{formatVND(row.revenue)} ({row.revenue_percentage}%)</strong>
                      </span>
                      <span className={base.progressBarTrack} style={{ display: "block" }}>
                        <span className={base.progressBarFill} style={{ display: "block", width: `${Math.min(100, Math.max(row.revenue_percentage > 0 ? 3 : 0, row.revenue_percentage))}%`, backgroundColor: "#8b5cf6" }} />
                      </span>
                      <small className={styles.muted}>{formatNumber(row.product_count)} SP đang bán · đã bán {formatNumber(row.quantity_sold)}</small>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
      {stockView && <StockListDrawer view={stockView} range={range} suspended={selectedSku !== null} onSelectProduct={setSelectedSku} onClose={closeStockList} />}
      {selectedSku && <ProductSalesDrawer sku={selectedSku} period={period} range={range} chartKind={chartKind} onChartKind={setChartKind} onClose={closeProduct} />}
    </div>
  );
}

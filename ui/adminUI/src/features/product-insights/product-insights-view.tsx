"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, BarChart3, Calendar, CalendarDays, Download, Layers, RefreshCw, Search, Tag, X } from "lucide-react";
import { PieChartSVG } from "../customer-insights/pie-chart-svg";
import base from "../customer-insights/customer-insights.module.css";
import styles from "./product-insights.module.css";
import {
  compactVND,
  fetchAllProducts,
  fetchStockList,
  formatNumber,
  formatVND,
  quarterRange,
  yearRange,
  type InsightsRange,
  type InvoiceTimelinePoint,
  type ProductSalesItem,
  type ProductStockList,
} from "./product-insights-data";
import { useProductInsights } from "./use-product-insights";
import { ProductSalesDrawer, type ChartKind } from "./product-sales-drawer";
import { StockBadge } from "./stock-badge";
import { BarChart } from "./bar-chart";
import { QuarterChart, quarterRows, type QuarterNumber } from "./quarterly-product-comparison";
import { buildProductInsightsWorkbook, productInsightsFileName } from "./product-insights-xlsx";
import { vietnamDay } from "../dashboard/dashboard-data";

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#64748b"];
const RANK_COLORS = ["#14a800", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#f97316", "#ec4899", "#64748b"];
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

type MonthMetric = "revenue" | "items" | "invoices";
const MONTH_METRICS: Record<MonthMetric, { tab: string; unit: "count" | "money"; value: (row: InvoiceTimelinePoint) => number }> = {
  revenue: { tab: "Doanh thu", unit: "money", value: row => Number(row.pre_tax) },
  items: { tab: "Số lượng", unit: "count", value: row => row.items_sold },
  invoices: { tab: "Hóa đơn", unit: "count", value: row => row.invoice_count },
};

/** One topic shown twice: the table on the left and the same figures as a chart on the right. */
function Pair({ index, icon, title, sub, table, chart, chartTools }: {
  index: number; icon: React.ReactNode; title: string; sub: string; table: React.ReactNode; chart: React.ReactNode; chartTools?: React.ReactNode;
}) {
  return (
    <section className={styles.pairSection} aria-label={title}>
      <div className={styles.pairHeading}>
        <h2>{icon} {index}. {title}</h2>
        <p>{sub}</p>
      </div>
      <div className={styles.pairRow}>
        <div className={`${base.card} ${styles.pairCard}`}>
          <span className={styles.pairTag}>Bảng số liệu</span>
          {table}
        </div>
        <div className={`${base.card} ${styles.pairCard}`}>
          <div className={styles.pairCardHead}>
            <span className={styles.pairTag}>Biểu đồ</span>
            {chartTools}
          </div>
          {chart}
        </div>
      </div>
    </section>
  );
}

/** Horizontal bars for a ranked list (same rows as the table beside it). */
function HorizontalBars({ rows, empty }: { rows: { key: string; label: string; value: number; text: string; color: string }[]; empty: string }) {
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className={styles.hbarList}>
      {rows.map(row => (
        <div key={row.key} className={styles.hbarRow} title={`${row.label}: ${row.text}`}>
          <span className={styles.hbarLabel}>{row.label}</span>
          <div className={styles.hbarTrack}>
            <div className={styles.hbarFill} style={{ width: `${row.value > 0 ? Math.max(3, (row.value / max) * 100) : 0}%`, backgroundColor: row.color }} />
          </div>
          <span className={styles.hbarValue}>{row.text}</span>
        </div>
      ))}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const settled = state.key === key ? state : { list: null, error: null };
  return { active: text.trim() !== "", pending: text.trim() !== query || (!settled.list && !settled.error), ...settled };
}

export function ProductInsightsView() {
  const currentYear = Number((vietnamDay(new Date()) ?? "2026-01-01").slice(0, 4));
  const yearOptions = useMemo(() => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3], [currentYear]);

  // One filter drives the whole page: a year, optionally narrowed to one quarter (click it in section 1).
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState<QuarterNumber | null>(null);
  const [monthMetric, setMonthMetric] = useState<MonthMetric>("revenue");
  const [topMetric, setTopMetric] = useState<"quantity" | "revenue">("quantity");
  const [drawerSku, setDrawerSku] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [topSearch, setTopSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const yearScope = useMemo(() => yearRange(year), [year]);
  const scope = useMemo(() => (quarter ? quarterRange(year, quarter) : null) ?? yearScope, [quarter, year, yearScope]);
  const scopeLabel = quarter ? `Quý ${quarter}/${year}` : `năm ${year}`;

  const quarterly = useProductInsights("quarter", yearScope);
  const detail = useProductInsights("month", scope);
  const report = detail.report;
  const search = useBestSellerSearch(topSearch, scope);
  const closeDrawer = useCallback(() => setDrawerSku(null), []);

  const chooseYear = (next: number) => { setYear(next); setQuarter(null); };
  const refresh = () => { quarterly.refresh(); detail.refresh(); };

  async function exportExcel() {
    if (!report || detail.loading || detail.error) return;
    setExporting(true);
    setExportError("");
    try {
      const [module, products] = await Promise.all([import("exceljs"), fetchAllProducts(scope)]);
      const Excel = ((module as unknown as { default?: typeof module }).default ?? module) as typeof import("exceljs");
      const book = buildProductInsightsWorkbook(Excel, report, products, new Date(), report);
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

  const quarters = quarterRows(quarterly.report?.timeline ?? [], year);
  const yearTotal = {
    quantity: quarters.reduce((s, q) => s + q.quantity, 0),
    invoices: quarters.reduce((s, q) => s + q.invoices, 0),
    revenue: quarters.reduce((s, q) => s + q.revenue, 0),
  };
  const months = report?.timeline ?? [];
  const monthTotal = {
    quantity: months.reduce((s, m) => s + m.items_sold, 0),
    invoices: months.reduce((s, m) => s + m.invoice_count, 0),
    revenue: months.reduce((s, m) => s + Number(m.pre_tax), 0),
  };
  const categories = report?.categories ?? [];
  const brands = report?.top_brands ?? [];
  const topRows: ProductSalesItem[] = search.active ? search.list?.items ?? [] : report?.top_products ?? [];
  const threshold = report?.product_summary.low_stock_threshold ?? 5;

  const detailState = detail.loading ? <p className={styles.empty} role="status">Đang tải {scopeLabel}…</p>
    : detail.error ? <p className={styles.dateFilterError} role="alert">{detail.error}</p> : null;

  return (
    <div className={base.page}>
      <div className={base.heading}>
        <div className={base.headingTitle}>
          <h1><BarChart3 size={26} color="#14a800" /> Thống kê sản phẩm & hóa đơn</h1>
          <p>Mỗi mục có bảng số liệu bên trái và biểu đồ của cùng số liệu đó bên phải</p>
        </div>
        <div className={base.headingActions}>
          <button type="button" className={base.btn} onClick={refresh} disabled={quarterly.loading || detail.loading}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <button type="button" className={`${base.btn} ${base.btnPrimary}`} onClick={() => void exportExcel()}
            disabled={!report || detail.loading || Boolean(detail.error) || exporting}>
            <Download size={16} /> {exporting ? "Đang xuất…" : "Xuất Excel"}
          </button>
        </div>
      </div>
      {exportError && <p className={`${base.stateBox} ${base.errorBox}`} role="alert" style={{ marginTop: 0 }}>{exportError}</p>}

      <div className={base.periodCard} role="group" aria-label="Bộ lọc thời gian">
        <div className={styles.scopeBar}>
          <label className={styles.yearSelect}>
            <span>Năm</span>
            <select value={year} onChange={e => chooseYear(Number(e.target.value))} aria-label="Chọn năm thống kê">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <span className={styles.scopeChip}>
            Đang xem: <strong>{quarter ? `Quý ${quarter}/${year}` : `Cả năm ${year}`}</strong>
            {scope.start && <small> ({scope.start} → {scope.end})</small>}
            {quarter && <button type="button" onClick={() => setQuarter(null)} aria-label="Xem cả năm"><X size={13} /> Cả năm</button>}
          </span>
          <span className={styles.muted}>Nhấn vào một quý ở mục 1 để các mục bên dưới chỉ tính quý đó</span>
        </div>
      </div>

      {/* 1. Theo quý */}
      <Pair
        index={1}
        icon={<Calendar size={18} color="#14a800" />}
        title={`Theo quý · năm ${year}`}
        sub="Hóa đơn của đơn chưa hủy; doanh thu trước thuế, sau giảm giá"
        table={quarterly.error ? <p className={styles.dateFilterError} role="alert">{quarterly.error}</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className={base.timelineTable}>
              <thead>
                <tr>
                  <th>Quý</th>
                  <th className={styles.num}>Số lượng bán</th>
                  <th className={styles.num}>Số hóa đơn</th>
                  <th className={styles.num}>Doanh thu</th>
                  <th className={styles.num}>Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map(q => (
                  <tr key={q.key}
                    className={`${q.started ? styles.clickableRow : styles.rowDisabled} ${quarter === q.quarter ? styles.quarterRowSelected : ""}`}
                    onClick={() => q.started && setQuarter(quarter === q.quarter ? null : q.quarter)}>
                    <td><strong>Quý {q.quarter}</strong>{!q.started && <small className={styles.muted}> · chưa bắt đầu</small>}</td>
                    <td className={styles.num}>{quarterly.loading ? "…" : formatNumber(q.quantity)}</td>
                    <td className={styles.num}>{quarterly.loading ? "…" : formatNumber(q.invoices)}</td>
                    <td className={styles.num}><strong>{quarterly.loading ? "…" : formatVND(q.revenue)}</strong></td>
                    <td className={styles.num}>{quarterly.loading ? "…" : `${share(q.revenue, yearTotal.revenue)}%`}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalRow}>
                  <td>Cả năm</td>
                  <td className={styles.num}>{formatNumber(yearTotal.quantity)}</td>
                  <td className={styles.num}>{formatNumber(yearTotal.invoices)}</td>
                  <td className={styles.num}>{formatVND(yearTotal.revenue)}</td>
                  <td className={styles.num}>{yearTotal.revenue > 0 ? "100%" : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        chart={quarterly.error ? null : <QuarterChart rows={quarters} selected={quarter} onSelect={setQuarter} loading={quarterly.loading} />}
      />

      {/* 2. Theo tháng */}
      <Pair
        index={2}
        icon={<CalendarDays size={18} color="#14a800" />}
        title={`Theo tháng · ${scopeLabel}`}
        sub="Chi tiết từng tháng trong phạm vi đang xem"
        chartTools={
          <div className={base.periodTabs} aria-label="Chỉ số biểu đồ tháng">
            {(Object.keys(MONTH_METRICS) as MonthMetric[]).map(key => (
              <button key={key} type="button" aria-pressed={monthMetric === key}
                className={`${base.periodTab} ${monthMetric === key ? base.periodTabActive : ""}`} onClick={() => setMonthMetric(key)}>
                {MONTH_METRICS[key].tab}
              </button>
            ))}
          </div>
        }
        table={detailState ?? (months.length === 0 ? <p className={styles.empty}>Chưa có hóa đơn trong {scopeLabel}.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className={base.timelineTable}>
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th className={styles.num}>Số lượng bán</th>
                  <th className={styles.num}>Số hóa đơn</th>
                  <th className={styles.num}>Doanh thu</th>
                  <th className={styles.num}>Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => (
                  <tr key={m.period}>
                    <td><strong>{m.label}</strong></td>
                    <td className={styles.num}>{formatNumber(m.items_sold)}</td>
                    <td className={styles.num}>{formatNumber(m.invoice_count)}</td>
                    <td className={styles.num}><strong>{formatVND(m.pre_tax)}</strong></td>
                    <td className={styles.num}>{share(Number(m.pre_tax), monthTotal.revenue)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalRow}>
                  <td>Tổng</td>
                  <td className={styles.num}>{formatNumber(monthTotal.quantity)}</td>
                  <td className={styles.num}>{formatNumber(monthTotal.invoices)}</td>
                  <td className={styles.num}>{formatVND(monthTotal.revenue)}</td>
                  <td className={styles.num}>{monthTotal.revenue > 0 ? "100%" : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
        chart={detailState ? null : months.length === 0 ? <p className={styles.empty}>Chưa có hóa đơn trong {scopeLabel}.</p> : (
          <BarChart
            unit={MONTH_METRICS[monthMetric].unit}
            ariaLabel={`${MONTH_METRICS[monthMetric].tab} theo tháng, ${scopeLabel}`}
            points={months.map(m => ({
              period: m.period, label: m.label, value: MONTH_METRICS[monthMetric].value(m),
              details: [["Số lượng", formatNumber(m.items_sold)], ["Hóa đơn", formatNumber(m.invoice_count)], ["Doanh thu", formatVND(m.pre_tax)]],
            }))}
          />
        )}
      />

      {/* 3. Theo loại sản phẩm */}
      <Pair
        index={3}
        icon={<Layers size={18} color="#14a800" />}
        title={`Theo loại sản phẩm · ${scopeLabel}`}
        sub="Doanh thu chưa thuế và số lượng bán trong kỳ; tồn khả dụng là số hiện tại"
        table={detailState ?? (categories.length === 0 ? <p className={styles.empty}>Chưa có loại sản phẩm.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className={base.timelineTable}>
              <thead>
                <tr>
                  <th>Loại sản phẩm</th>
                  <th className={styles.num}>Đã bán</th>
                  <th className={styles.num}>Tồn khả dụng</th>
                  <th className={styles.num}>Doanh thu</th>
                  <th className={styles.num}>Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => (
                  <tr key={cat.category_id}>
                    <td><span className={styles.legendDot} style={{ backgroundColor: index < 7 && Number(cat.revenue) > 0 ? PALETTE[index % PALETTE.length] : "#cbd5e1" }} /><strong>{cat.category_name}</strong></td>
                    <td className={styles.num}>{formatNumber(cat.quantity_sold)}</td>
                    <td className={styles.num}>{formatNumber(cat.available_units)}</td>
                    <td className={styles.num}><strong>{formatVND(cat.revenue)}</strong></td>
                    <td className={styles.num}>{cat.revenue_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        chart={detailState ? null : (
          <PieChartSVG
            title="Tỷ trọng doanh thu"
            slices={categories.slice(0, 7).filter(c => Number(c.revenue) > 0).map((cat) => ({
              label: cat.category_name, value: Number(cat.revenue), percentage: cat.revenue_percentage,
              color: PALETTE[categories.indexOf(cat) % PALETTE.length],
            }))}
            centerLabel={compactVND(categories.reduce((s, c) => s + Number(c.revenue), 0))}
            centerSub="doanh thu"
            emptyText="Chưa có doanh thu"
          />
        )}
      />

      {/* 4. Theo thương hiệu */}
      <Pair
        index={4}
        icon={<Tag size={18} color="#14a800" />}
        title={`Theo thương hiệu · ${scopeLabel}`}
        sub="Doanh thu chưa thuế và số lượng bán trong kỳ"
        table={detailState ?? (brands.length === 0 ? <p className={styles.empty}>Chưa có dữ liệu thương hiệu.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className={base.timelineTable}>
              <thead>
                <tr>
                  <th>Thương hiệu</th>
                  <th className={styles.num}>SP đang bán</th>
                  <th className={styles.num}>Đã bán</th>
                  <th className={styles.num}>Doanh thu</th>
                  <th className={styles.num}>Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b, index) => (
                  <tr key={b.brand}>
                    <td><span className={styles.legendDot} style={{ backgroundColor: index < 7 && Number(b.revenue) > 0 ? PALETTE[index % PALETTE.length] : "#cbd5e1" }} /><strong>{b.brand}</strong></td>
                    <td className={styles.num}>{formatNumber(b.product_count)}</td>
                    <td className={styles.num}>{formatNumber(b.quantity_sold)}</td>
                    <td className={styles.num}><strong>{formatVND(b.revenue)}</strong></td>
                    <td className={styles.num}>{b.revenue_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        chart={detailState ? null : (
          <PieChartSVG
            title="Tỷ trọng doanh thu"
            slices={brands.slice(0, 7).filter(b => Number(b.revenue) > 0).map(b => ({
              label: b.brand, value: Number(b.revenue), percentage: b.revenue_percentage,
              color: PALETTE[brands.indexOf(b) % PALETTE.length],
            }))}
            centerLabel={compactVND(brands.reduce((s, b) => s + Number(b.revenue), 0))}
            centerSub="doanh thu"
            emptyText="Chưa có doanh thu"
          />
        )}
      />

      {/* 5. Top sản phẩm bán chạy */}
      <Pair
        index={5}
        icon={<Award size={18} color="#14a800" />}
        title={`Top sản phẩm bán chạy · ${scopeLabel}`}
        sub="Xếp theo số lượng bán · nhấn vào sản phẩm để xem diễn biến, kênh bán và tồn theo kho"
        chartTools={
          <div className={base.periodTabs} aria-label="Chỉ số biểu đồ sản phẩm">
            {([["quantity", "Số lượng"], ["revenue", "Doanh thu"]] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={topMetric === key}
                className={`${base.periodTab} ${topMetric === key ? base.periodTabActive : ""}`} onClick={() => setTopMetric(key)}>
                {label}
              </button>
            ))}
          </div>
        }
        table={detailState ?? (
          <>
            <label className={`${styles.searchBox} ${styles.cardSearch}`}>
              <Search size={15} aria-hidden="true" />
              <input type="search" value={topSearch} onChange={event => setTopSearch(event.target.value)} maxLength={100}
                placeholder="Tìm sản phẩm theo tên hoặc SKU…" aria-label="Tìm sản phẩm" />
            </label>
            {search.active && search.error ? <p className={styles.empty} role="alert">{search.error}</p>
              : search.active && (search.pending || !search.list) ? <p className={styles.empty} role="status">Đang tìm…</p>
              : topRows.length === 0 ? <p className={styles.empty}>{search.active ? `Không tìm thấy sản phẩm khớp “${topSearch.trim()}”.` : `Chưa có sản phẩm bán ra trong ${scopeLabel}.`}</p>
              : (
                <div style={{ overflowX: "auto" }}>
                  <table className={base.timelineTable}>
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th className={styles.num}>Đã bán</th>
                        <th className={styles.num}>Doanh thu</th>
                        <th className={styles.num}>Tồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRows.map((row, index) => {
                        const rankClass = index === 0 ? styles.rank1 : index === 1 ? styles.rank2 : index === 2 ? styles.rank3 : "";
                        return (
                          <tr key={row.sku} className={styles.clickableRow} onClick={() => setDrawerSku(row.sku)}>
                            <td>
                              <div className={styles.rankProductCell}>
                                <span className={`${styles.rankBadge} ${rankClass}`}>{index + 1}</span>
                                <div className={styles.rankProductInfo}>
                                  <button type="button" className={styles.productButton}
                                    onClick={event => { event.stopPropagation(); setDrawerSku(row.sku); }}>{row.name}</button>
                                  <small className={styles.muted}>{row.sku} · {row.category_name}</small>
                                </div>
                              </div>
                            </td>
                            <td className={styles.num}><strong>{formatNumber(row.quantity_sold)}</strong></td>
                            <td className={styles.num}>{formatVND(row.revenue)}</td>
                            <td className={styles.num}><StockBadge available={row.available_units} threshold={threshold} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
        chart={detailState ? null : (
          <HorizontalBars
            empty={`Chưa có sản phẩm bán ra trong ${scopeLabel}.`}
            rows={topRows.map((row, index) => ({
              key: row.sku,
              label: `${index + 1}. ${row.name}`,
              value: topMetric === "quantity" ? row.quantity_sold : Number(row.revenue),
              text: topMetric === "quantity" ? `${formatNumber(row.quantity_sold)} SP` : compactVND(Number(row.revenue)),
              color: RANK_COLORS[index % RANK_COLORS.length],
            }))}
          />
        )}
      />

      {drawerSku && <ProductSalesDrawer key={drawerSku} sku={drawerSku} period="month" range={scope} chartKind={chartKind} onChartKind={setChartKind} onClose={closeDrawer} />}
    </div>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { ArrowDownLeft, Banknote, Package, Percent, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import type { BusinessReport } from "./report-data";
import { negativeAmount, reportAmount, reportDate, reportPercent } from "./report-format";
import styles from "./reports.module.css";

export function ReportMetrics({ report }: { report: BusinessReport }) {
  const metrics = [
    { label: "Tiền đã thu", value: reportAmount(report.collected), note: "Đã trừ hoàn tiền · gồm đơn chưa hoàn thành", icon: Banknote, unavailable: false, loss: negativeAmount(report.collected), highlight: true },
    { label: "Doanh thu sau giảm giá", value: reportAmount(report.net_revenue), note: "Chưa thuế · đơn đã hoàn thành", icon: Wallet, unavailable: false, loss: negativeAmount(report.net_revenue) },
    { label: "Giá vốn hàng đã bán", value: reportAmount(report.cost), note: `${report.costed_lines}/${report.total_lines} dòng đủ dữ liệu giá vốn`, icon: Package, unavailable: report.cost === null, loss: false },
    { label: "Lợi nhuận gộp", value: reportAmount(report.gross_profit), note: "Doanh thu chưa thuế − giá vốn", icon: TrendingUp, unavailable: report.gross_profit === null, loss: negativeAmount(report.gross_profit), highlight: true },
    { label: "Biên lợi nhuận gộp", value: reportPercent(report.margin), note: "Tỷ lệ lợi nhuận trên doanh thu", icon: Percent, unavailable: report.margin === null, loss: negativeAmount(report.margin) },
  ];
  return <div className={styles.metrics}>{metrics.map(({ label, value, note, icon: Icon, unavailable, loss, highlight }) =>
    <article key={label} className={`${styles.metric} ${highlight ? styles.profitMetric : ""}`} aria-label={label}>
      <div className={styles.metricHeading}><span>{label}</span><span className={styles.metricIcon}><Icon size={18} aria-hidden="true" /></span></div>
      <strong className={`${styles.metricValue} ${unavailable ? styles.unavailable : ""} ${loss ? styles.loss : ""}`}>{value}</strong>
      <small>{note}</small>
    </article>)}</div>;
}

const axisNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
function axisAmount(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return axisNumber.format(value / 1e9) + " tỷ";
  if (absolute >= 1e6) return axisNumber.format(value / 1e6) + " tr";
  if (absolute >= 1e3) return axisNumber.format(value / 1e3) + " k";
  return axisNumber.format(value);
}

function ReportTrend({ report }: { report: BusinessReport }) {
  const gradient = useId().replaceAll(":", "");
  const [active, setActive] = useState<number | null>(null);
  const chart = useMemo(() => {
    // Number is used only for drawing coordinates. Displayed money always comes
    // from the API's original decimal strings; no financial totals are computed here.
    const width = 720, height = 230, left = 64, right = 20, top = 18, bottom = 32;
    const values = report.daily.flatMap(row => row.gross_profit === null ? [Number(row.net_revenue)] : [Number(row.net_revenue), Number(row.gross_profit)]);
    const minimum = Math.min(0, ...values), maximum = Math.max(0, ...values);
    const span = maximum - minimum || 1;
    const x = (index: number) => left + (report.daily.length === 1 ? .5 : index / Math.max(1, report.daily.length - 1)) * (width - left - right);
    const y = (value: number) => top + (maximum - value) / span * (height - top - bottom);
    const points = report.daily.map((row, index) => ({ ...row, x: x(index), revenueY: y(Number(row.net_revenue)), profitY: row.gross_profit === null ? null : y(Number(row.gross_profit)) }));
    let revenuePath = "", profitPath = "", segment = false;
    points.forEach((point, index) => {
      revenuePath += `${index ? "L" : "M"}${point.x.toFixed(2)},${point.revenueY.toFixed(2)} `;
      if (point.profitY === null) segment = false;
      else { profitPath += `${segment ? "L" : "M"}${point.x.toFixed(2)},${point.profitY.toFixed(2)} `; segment = true; }
    });
    const ticks = Array.from({ length: 5 }, (_, index) => minimum + span * index / 4);
    const labels = [...new Set([0, Math.round((points.length - 1) / 3), Math.round((points.length - 1) * 2 / 3), points.length - 1])];
    return { width, height, left, right, points, ticks, labels, y, revenuePath, profitPath, zero: y(0), empty: values.every(value => value === 0) };
  }, [report.daily]);
  const defaultIndex = chart.points.findIndex(point => Number(point.net_revenue) !== 0 || (point.gross_profit !== null && Number(point.gross_profit) !== 0));
  const selectedIndex = Math.min(active ?? Math.max(defaultIndex, 0), chart.points.length - 1);
  const selected = chart.points[selectedIndex];

  return <section className={styles.trendCard} aria-label="Diễn biến doanh thu và lợi nhuận">
    <div className={styles.cardHeading}><div><h2>Doanh thu & lợi nhuận</h2><p>Theo ngày hoàn thành đơn hàng</p></div><span className={styles.unit}>Đơn vị: đồng</span></div>
    <div className={styles.chartLegend}><span><i className={styles.revenueDot} />Doanh thu chưa thuế</span><span><i className={styles.profitDot} />Lợi nhuận gộp</span></div>
    {chart.empty ? <div className={styles.chartEmpty}><TrendingUp size={30} aria-hidden="true" /><strong>Chưa có doanh thu trong kỳ</strong><p>Chọn khoảng thời gian khác để xem diễn biến bán hàng.</p></div> : <>
      <div className={styles.chartReadout}><span>{selected ? reportDate(selected.day) : ""}</span><strong>{selected ? reportAmount(selected.net_revenue) : ""}</strong><span>Lợi nhuận: {selected ? reportAmount(selected.gross_profit) : ""}</span></div>
      <svg className={styles.trendSvg} viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" tabIndex={0}
        aria-label="Biểu đồ doanh thu và lợi nhuận theo ngày. Dùng phím mũi tên để xem từng ngày."
        onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setActive(Math.max(0, Math.min(chart.points.length - 1, selectedIndex + (event.key === "ArrowRight" ? 1 : -1)))); } }}
        onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - bounds.left) / bounds.width * chart.width; setActive(Math.max(0, Math.min(chart.points.length - 1, Math.round((x - chart.left) / (chart.width - chart.left - chart.right) * (chart.points.length - 1))))); }}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14a800" stopOpacity=".14" /><stop offset="100%" stopColor="#14a800" stopOpacity="0" /></linearGradient></defs>
        {chart.ticks.map((value, index) => <g key={index}><line x1={chart.left} x2={chart.width - chart.right} y1={chart.y(value)} y2={chart.y(value)} stroke="#e9ede8" strokeDasharray="4 5" /><text x={chart.left - 12} y={chart.y(value) + 4} textAnchor="end">{axisAmount(value)}</text></g>)}
        {chart.points.length > 1 && <path d={`${chart.revenuePath} L${chart.points.at(-1)!.x},${chart.zero} L${chart.points[0].x},${chart.zero} Z`} fill={`url(#${gradient})`} />}
        <path d={chart.revenuePath} fill="none" stroke="#14a800" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={chart.profitPath} fill="none" stroke="#617789" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        {selected && <g><line x1={selected.x} x2={selected.x} y1={12} y2={chart.height - 32} stroke="#c4cec1" strokeDasharray="3 4" /><circle cx={selected.x} cy={selected.revenueY} r={4.5} fill="#14a800" stroke="white" strokeWidth="2" />{selected.profitY !== null && <circle cx={selected.x} cy={selected.profitY} r={4} fill="#617789" stroke="white" strokeWidth="2" />}</g>}
        {chart.labels.map(index => <text key={index} x={chart.points[index].x} y={chart.height - 8} textAnchor="middle">{reportDate(chart.points[index].day).slice(0, 5)}</text>)}
      </svg>
    </>}
  </section>;
}

export function ReportOverview({ report }: { report: BusinessReport }) {
  return <div className={styles.overview}>
    <ReportTrend report={report} />
    <section className={styles.cashCard} aria-label="Dòng tiền trong kỳ">
      <div className={styles.cardHeading}><div><h2>Dòng tiền trong kỳ</h2><p>Theo ngày thanh toán</p></div><Banknote size={20} aria-hidden="true" /></div>
      <div className={styles.cashTotal}><span>Tiền thu trừ hoàn</span><strong className={negativeAmount(report.collected) ? styles.loss : ""}>{reportAmount(report.collected)}</strong></div>
      <div className={styles.cashRows}><div><span><ArrowDownLeft size={15} />Hoàn tiền trong kỳ</span><strong>{reportAmount(report.refunds)}</strong></div><div><span>Thuế của đơn hoàn thành</span><strong>{reportAmount(report.tax)}</strong></div><div><span>Giá trị bán gồm thuế</span><strong>{reportAmount(report.gross_revenue)}</strong></div></div>
      <div className={styles.orderCounts}><div><ShoppingBag size={17} /><strong>{report.order_count.toLocaleString("vi-VN")}</strong><span>đơn hoàn thành</span></div><div><Package size={17} /><strong>{report.quantity.toLocaleString("vi-VN")}</strong><span>sản phẩm đã bán</span></div></div>
      <p className={styles.cashNote}>{report.warehouse_id === null ? "Dòng tiền gồm các khoản thu/hoàn thành công ở tất cả kho, kể cả đơn chưa hoàn thành." : "Dòng tiền chỉ tính đơn hoàn toàn thuộc kho đã chọn; đơn có nhiều kho được tính trong báo cáo tất cả kho."} Theo ngày thanh toán, tách biệt với doanh thu theo ngày hoàn thành.</p>
    </section>
  </div>;
}

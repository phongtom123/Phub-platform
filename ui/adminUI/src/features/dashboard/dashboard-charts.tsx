"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, RefreshCw, ArrowUpRight } from "lucide-react";
import type { ModuleKey } from "@/src/types/admin";
import { orderStatuses, orderTrend, salesChannels, type ChartValue } from "./dashboard-data";
import type { useDashboardData } from "./use-dashboard-data";
import "./dashboard.css";

const number = (value: number) => value.toLocaleString("vi-VN");
const dayLabel = (day: string) => day.slice(8, 10) + "/" + day.slice(5, 7);

function ChartCard({ title, subtitle, loading, error, empty, action, children }: {
  title: string; subtitle: string; loading: boolean; error: string; empty: boolean; action: ReactNode; children: ReactNode;
}) {
  return <section className="dashboard-chart-card" aria-label={title}>
    <div className="dashboard-chart-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</div>
    {loading ? <div className="dashboard-chart-state" role="status">Đang tải thống kê…</div>
      : error ? <div className="dashboard-chart-state dashboard-chart-error" role="alert">{error}</div>
      : empty ? <div className="dashboard-chart-state">Chưa có dữ liệu để thống kê.</div> : children}
  </section>;
}

function ValuesTable({ values, unit }: { values: ChartValue[]; unit: string }) {
  return <details className="dashboard-chart-details"><summary>Xem số liệu</summary><table><thead><tr><th>Nhóm</th><th>{unit}</th></tr></thead><tbody>{values.map(item => <tr key={item.label}><td>{item.label}</td><td>{number(item.value)}</td></tr>)}</tbody></table></details>;
}

function HorizontalBars({ values, unit }: { values: ChartValue[]; unit: string }) {
  const max = Math.max(1, ...values.map(item => item.value));
  return <><div className="dashboard-bars">{values.slice(0, 8).map(item => <div className="dashboard-bar-row" key={item.label}>
    <div><span>{item.label}</span><strong>{number(item.value)} <small>{unit}</small></strong></div>
    <div className="dashboard-bar-track"><span style={{ width: `${item.value / max * 100}%`, backgroundColor: item.color }} /></div>
  </div>)}</div>{values.length > 8 && <p className="dashboard-chart-caption">Hiển thị 8 nhóm lớn nhất; xem số liệu để đọc toàn bộ.</p>}<ValuesTable values={values} unit={unit} /></>;
}

function StatusDonut({ values }: { values: ChartValue[] }) {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const gradient = values.map(item => {
    const start = offset; offset += item.value / total * 100;
    return `${item.color} ${start}% ${offset}%`;
  }).join(",");
  return <><div className="dashboard-donut-layout">
    <div className="dashboard-donut" role="img" aria-label={`Phân bố trạng thái của ${number(total)} đơn hàng`} style={{ background: `conic-gradient(${gradient})` }}><div><strong>{number(total)}</strong><span>đơn hàng</span></div></div>
    <ul className="dashboard-chart-legend">{values.map(item => <li key={item.label}><i style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{number(item.value)}</strong><small>{Math.round(item.value / total * 100)}%</small></li>)}</ul>
  </div><ValuesTable values={values} unit="Đơn hàng" /></>;
}

function TrendChart({ trend }: { trend: ReturnType<typeof orderTrend> }) {
  const max = Math.max(1, ...trend.points.map(point => point.value));
  const top = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const left = 42, right = 680, bottom = 210, upper = 20;
  const points = trend.points.map((point, index) => ({ ...point, x: left + index / (trend.points.length - 1) * (right - left), y: bottom - point.value / top * (bottom - upper) }));
  const line = points.map(point => `${point.x},${point.y}`).join(" ");
  return <><div className="dashboard-trend-total"><strong>{number(trend.total)}</strong><span>đơn trong khoảng đã chọn · bao gồm đơn hủy</span></div>
    <div className="dashboard-trend-scroll"><svg className="dashboard-trend" viewBox="0 0 720 255" role="img" aria-label={`Đơn hàng từ ${dayLabel(points[0].day)} đến ${dayLabel(points.at(-1)!.day)}: ${trend.total} đơn`}>
      {Array.from({ length: 5 }, (_, index) => { const y = bottom - index / 4 * (bottom - upper); return <g key={index}><line x1={left} x2={right} y1={y} y2={y} stroke="#e5e9e2" strokeDasharray="4 5" /><text x={left - 10} y={y + 5} textAnchor="end">{top / 4 * index}</text></g>; })}
      <polygon points={`${left},${bottom} ${line} ${right},${bottom}`} fill="#14a800" fillOpacity=".09" />
      <polyline points={line} fill="none" stroke="#14a800" strokeWidth="3" strokeLinejoin="round" />
      {points.map((point, index) => <g key={point.day}><circle cx={point.x} cy={point.y} r={point.value ? 4 : 2} fill="#14a800"><title>{dayLabel(point.day)}: {point.value} đơn</title></circle>{(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0) && <text x={point.x} y="242" textAnchor="middle">{dayLabel(point.day)}</text>}</g>)}
    </svg></div>
    {trend.total === 0 && <p className="dashboard-chart-caption">Không có đơn trong khoảng đã chọn. Thử chọn khoảng dài hơn.</p>}
    {trend.invalidDates > 0 && <p className="dashboard-chart-caption">{number(trend.invalidDates)} đơn thiếu ngày hợp lệ, không đưa vào biểu đồ theo ngày.</p>}
    <ValuesTable values={points.map(point => ({ label: point.day, value: point.value, color: "#14a800" }))} unit="Đơn hàng" />
  </>;
}

export function DashboardCharts({ data, onNavigate }: { data: ReturnType<typeof useDashboardData>; onNavigate: (key: ModuleKey) => void }) {
  const [days, setDays] = useState(30);
  const orders = data.orders.data;
  const trend = useMemo(() => data.today ? orderTrend(orders ?? [], data.today, days) : null, [orders, data.today, days]);
  const statuses = useMemo(() => orderStatuses(orders ?? []), [orders]);
  const channels = useMemo(() => salesChannels(orders ?? []), [orders]);
  const link = (module: ModuleKey, label: string) => <button className="dashboard-chart-link" aria-label={label} onClick={() => onNavigate(module)}><ArrowUpRight size={18} /></button>;
  return <section className="dashboard-statistics" aria-label="Thống kê hoạt động">
    <div className="dashboard-statistics-toolbar"><div><h2><BarChart3 size={22} /> Thống kê hoạt động</h2><p>Dữ liệu thật từ API · ngày theo giờ Việt Nam</p></div><button className="dashboard-refresh" onClick={data.refresh}><RefreshCw size={17} /> Làm mới thống kê</button></div>
    <div className="dashboard-chart-grid">
      <ChartCard title="Đơn hàng theo ngày" subtitle="Số đơn được đặt, không phải doanh thu" loading={data.orders.loading || !trend} error={data.orders.error} empty={false} action={<label className="dashboard-period">Khoảng thời gian<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 ngày gần nhất</option><option value={30}>30 ngày gần nhất</option><option value={90}>90 ngày gần nhất</option></select></label>}>
        {trend && <TrendChart trend={trend} />}
      </ChartCard>
      <ChartCard title="Trạng thái đơn hàng" subtitle="Phân bố tất cả đơn hàng" loading={data.orders.loading} error={data.orders.error} empty={!orders?.length} action={link("orders", "Mở danh sách đơn hàng")}><StatusDonut values={statuses} /></ChartCard>
      <ChartCard title="Tồn kho theo kho" subtitle="Tổng số lượng tồn, không phải số SKU" loading={data.inventory.loading} error={data.inventory.error} empty={!data.inventory.data?.length} action={link("inventory", "Mở danh sách tồn kho")}><HorizontalBars values={data.inventory.data ?? []} unit="sản phẩm" /></ChartCard>
      <ChartCard title="Đơn hàng theo kênh bán" subtitle="Tất cả đơn online và tại quầy, bao gồm đơn hủy" loading={data.orders.loading} error={data.orders.error} empty={!orders?.length} action={link("orders", "Mở đơn hàng theo kênh bán")}><HorizontalBars values={channels} unit="đơn" /></ChartCard>
    </div>
  </section>;
}

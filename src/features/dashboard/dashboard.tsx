"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, Clock3, Package, Search, TriangleAlert } from "lucide-react";
import { MetricCard, Panel, StatusBadge } from "@/src/components/warehouse/ui";
import { modules } from "@/src/data/warehouse-data";
import type { DataRow } from "@/src/types/warehouse";
import { getDispatches, getInventory, getReceipts, getTransfers, hasApiToken } from "@/src/lib/warehouse-api";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [apiInventory, setApiInventory] = useState<DataRow[] | null>(null);
  const [metrics, setMetrics] = useState({ sku: "1,842", pending: "5", pendingFoot: "3 phiếu nhập · 2 phiếu chuyển" });
  const [activities, setActivities] = useState<{ kind: "receipt" | "transfer" | "dispatch"; title: string; detail: string; code: string; time: string }[]>([]);
  useEffect(() => {
    if (!hasApiToken()) return;
    let cancelled = false;
    Promise.all([getInventory(), getReceipts(), getTransfers(), getDispatches()]).then(([inventoryResult, receipts, transfers, dispatches]) => {
      if (cancelled) return;
      const rows = inventoryResult.items.map(item => ({ id: item.sku, name: item.product_name, code: `${item.sku} · ${item.unit}`, location: item.location ?? "—", quantity: item.quantity, status: item.status }));
      const pendingReceipts = receipts.filter(item => ["Nháp", "Chờ xác nhận"].includes(String(item.status))).length;
      const pendingTransfers = transfers.filter(item => ["Nháp", "Đang chuyển"].includes(String(item.status))).length;
      const pendingDispatches = dispatches.filter(item => ["Chờ xử lý", "Đã xác nhận", "Đang soạn"].includes(String(item.status))).length;
      setApiInventory(rows);
      setMetrics({ sku: String(new Set(rows.map(row => row.id)).size), pending: String(pendingReceipts + pendingTransfers + pendingDispatches), pendingFoot: `${pendingReceipts} phiếu nhập · ${pendingTransfers} phiếu chuyển · ${pendingDispatches} phiếu xuất` });
      setActivities([
        ...receipts.slice(-3).map(item => ({ kind: "receipt" as const, title: item.status === "Đã nhập" ? "Phiếu nhập đã hoàn tất" : "Phiếu nhập cần xử lý", detail: `${item.items} · ${item.supplier}`, code: item.id, time: item.created })),
        ...transfers.slice(-3).map(item => ({ kind: "transfer" as const, title: item.status === "Đã nhận" ? "Phiếu chuyển đã nhận" : "Phiếu chuyển đang xử lý", detail: `${item.items} · ${item.from} → ${item.to}`, code: item.id, time: item.created })),
        ...dispatches.slice(-3).map(item => ({ kind: "dispatch" as const, title: item.status === "Đã xuất" ? "Đơn hàng đã xuất kho" : "Đơn hàng cần xuất kho", detail: `${item.items} · ${item.order}`, code: item.id, time: item.created })),
      ].slice(-4).reverse());
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const fallbackInventory = modules.inventory!.rows;
  const inventory = useMemo(() => (apiInventory ?? fallbackInventory).filter((row) => Object.values(row).some(value => String(value).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")))), [apiInventory, fallbackInventory, query]);
  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return <><div className="page-heading dashboard-heading"><div className="date-pill"><Clock3 size={14}/> {today} <span>⌄</span></div></div>
    <section className="metric-grid"><MetricCard label="Tổng SKU trong kho" value={metrics.sku} foot="Theo dữ liệu tồn kho hiện tại" icon="box" href="/products"/><MetricCard label="Phiếu chờ xử lý" value={metrics.pending} foot={metrics.pendingFoot} icon="clock" href="/pending"/></section>
    <div className="dashboard-grid"><Panel title="Tồn kho" subtitle="Số lượng sản phẩm đang lưu tại kho trung tâm" action={<Link className="text-link" href="/inventory">Xem tất cả <ArrowRight size={13}/></Link>}>
        <div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm"/></label></div><InventoryTable rows={inventory}/>
      </Panel>
      <Panel title="Hoạt động gần đây" subtitle="Giao dịch mới nhất tại kho" action={<Link className="text-link" href="/history">Lịch sử <ArrowRight size={13}/></Link>}>
        <div className="activity-list">{activities.length ? activities.map(item => <Activity key={`${item.kind}-${item.code}`} icon={item.kind === "receipt" ? <ArrowDownToLine size={15}/> : item.kind === "transfer" ? <ArrowLeftRight size={15}/> : <ArrowUpFromLine size={15}/>} title={item.title} detail={item.detail} code={item.code} time={item.time}/>) : <div className="module-note"><Package size={15}/> Chưa có hoạt động kho.</div>}</div>
      </Panel></div>
    <div className="dashboard-grid lower-grid"><Panel title="Cần xử lý" subtitle="Các công việc đang chờ bạn" action={<StatusBadge value={`${metrics.pending} việc`}/> }>
        <div className="task-row"><TriangleAlert size={15}/><span><strong>{metrics.pendingFoot.split(" · ")[0]}</strong> đang chờ xác nhận nhập kho</span><small>theo dữ liệu hiện tại</small></div><div className="task-row"><TriangleAlert size={15}/><span><strong>{metrics.pendingFoot.split(" · ")[1]}</strong> đang chờ xử lý chuyển kho</span><small>theo dữ liệu hiện tại</small></div><div className="task-row"><TriangleAlert size={15}/><span><strong>{metrics.pendingFoot.split(" · ")[2]}</strong> đang chờ xuất kho</span><small>theo dữ liệu hiện tại</small></div>
      </Panel><Panel title="Thao tác nhanh" subtitle="Truy cập các nghiệp vụ thường dùng"><div className="quick-link-grid"><Link href="/receipts"><span><ArrowDownToLine size={15}/></span>Nhận hàng nhập kho</Link><Link href="/transfers"><span><ArrowLeftRight size={15}/></span>Xử lý chuyển kho</Link><Link href="/history"><span><Clock3 size={15}/></span>Xem lịch sử giao dịch</Link></div></Panel></div>
  </>;
}

function InventoryTable({ rows }: { rows: DataRow[] }) { return <div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>VỊ TRÍ</th><th>TỒN HIỆN TẠI</th><th>TÌNH TRẠNG</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="product-cell"><span className="product-thumb"><Package size={16}/></span><span><strong>{row.name}</strong><small>{row.code}</small></span></span></td><td>{row.location}</td><td className="strong-value">{row.quantity}</td><td><StatusBadge value={row.status}/></td></tr>)}</tbody></table></div>; }
function Activity({ icon, title, detail, code, time }: { icon: React.ReactNode; title: string; detail: string; code: string; time: string }) { return <div className="activity-item"><span className="activity-icon">{icon}</span><div className="activity-copy"><strong>{title}</strong><span>{detail}</span><small>{code}</small></div><time>{time}</time></div>; }

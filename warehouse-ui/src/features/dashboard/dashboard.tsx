"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, Clock3, Package, PackageCheck, Search, TriangleAlert } from "lucide-react";
import { MetricCard, Panel, StatusBadge } from "@/src/components/warehouse/ui";
import { modules } from "@/src/data/warehouse-data";
import type { DataRow } from "@/src/types/warehouse";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const inventory = modules.inventory!.rows.filter((row) => Object.values(row).some(value => String(value).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))));
  return <><div className="page-heading dashboard-heading"><div className="date-pill"><Clock3 size={14}/> Chủ nhật, 27 tháng 9, 2026 <span>⌄</span></div></div>
    <section className="metric-grid"><MetricCard label="Tổng SKU trong kho" value="1,842" foot="+24 sản phẩm trong tháng này" icon="box" href="/products"/><MetricCard label="Phiếu chờ xử lý" value="5" foot="3 phiếu nhập · 2 phiếu chuyển" icon="clock" href="/pending"/></section>
    <div className="dashboard-grid"><Panel title="Tồn kho" subtitle="Số lượng sản phẩm đang lưu tại kho trung tâm" action={<Link className="text-link" href="/inventory">Xem tất cả <ArrowRight size={13}/></Link>}>
        <div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm"/></label></div><InventoryTable rows={inventory}/>
      </Panel>
      <Panel title="Hoạt động gần đây" subtitle="Giao dịch mới nhất tại kho" action={<Link className="text-link" href="/history">Lịch sử <ArrowRight size={13}/></Link>}>
        <div className="activity-list"><Activity icon={<ArrowDownToLine size={15}/>} title="Phiếu nhập đã hoàn tất" detail="Nhập 12 sản phẩm · ASUS Việt Nam" code="PN-260927-03" time="09:42"/><Activity icon={<ArrowLeftRight size={15}/>} title="Phiếu chuyển đang giao" detail="Kho trung tâm → Kho Quận 1" code="CK-260927-02" time="09:15"/><Activity icon={<ArrowUpFromLine size={15}/>} title="Phiếu xuất đã xác nhận" detail="Xuất 4 sản phẩm · Đơn #PH240931" code="PX-260927-08" time="08:50"/><Activity icon={<Package size={15}/>} title="Xuất kho theo đơn hàng" detail="4 sản phẩm · Đơn #PH240931" code="XK-260927-08" time="08:22"/></div>
      </Panel></div>
    <div className="dashboard-grid lower-grid"><Panel title="Cần xử lý" subtitle="Các công việc đang chờ bạn" action={<StatusBadge value="5 việc"/>}>
        <div className="task-row"><TriangleAlert size={15}/><span><strong>3 phiếu nhập</strong> đang chờ xác nhận nhập kho</span><small>10:00 · hôm nay</small></div><div className="task-row"><TriangleAlert size={15}/><span><strong>2 phiếu chuyển</strong> chờ xác nhận giao hàng</span><small>11:30 · hôm nay</small></div>
      </Panel><Panel title="Thao tác nhanh" subtitle="Truy cập các nghiệp vụ thường dùng"><div className="quick-link-grid"><Link href="/receipts"><span><ArrowDownToLine size={15}/></span>Nhận hàng nhập kho</Link><Link href="/transfers"><span><ArrowLeftRight size={15}/></span>Xử lý chuyển kho</Link><Link href="/history"><span><Clock3 size={15}/></span>Xem lịch sử giao dịch</Link></div></Panel></div>
  </>;
}

function InventoryTable({ rows }: { rows: DataRow[] }) { return <div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>VỊ TRÍ</th><th>TỒN HIỆN TẠI</th><th>TÌNH TRẠNG</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="product-cell"><span className="product-thumb"><Package size={16}/></span><span><strong>{row.name}</strong><small>{row.code}</small></span></span></td><td>{row.location}</td><td className="strong-value">{row.quantity}</td><td><StatusBadge value={row.status}/></td></tr>)}</tbody></table></div>; }
function Activity({ icon, title, detail, code, time }: { icon: React.ReactNode; title: string; detail: string; code: string; time: string }) { return <div className="activity-item"><span className="activity-icon">{icon}</span><div className="activity-copy"><strong>{title}</strong><span>{detail}</span><small>{code}</small></div><time>{time}</time></div>; }

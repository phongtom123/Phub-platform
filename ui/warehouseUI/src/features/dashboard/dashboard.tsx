"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ClipboardCheck, Clock3, Package, PackageCheck, Search, TriangleAlert } from "lucide-react";
import { MetricCard, Panel, StatusBadge } from "@/src/components/warehouse/ui";
import { modules } from "@/src/data/warehouse-data";
import type { DataRow } from "@/src/types/warehouse";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const inventory = modules.inventory!.rows.filter((row) => row.status !== "Còn hàng" && Object.values(row).some(value => String(value).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))));
  return <><div className="page-heading"><div><h1>Tổng quan kho</h1><p>Theo dõi tình hình kho và xử lý công việc trong ngày.</p></div><div className="date-pill"><Clock3 size={14}/> Chủ nhật, 27 tháng 9, 2026 <span>⌄</span></div></div>
    <div className="quick-actions"><Link className="button primary" href="/receipts/new"><ArrowDownToLine size={15}/> Tạo phiếu nhập</Link><Link className="button" href="/transfers/new"><ArrowLeftRight size={15}/> Tạo phiếu chuyển</Link><Link className="button" href="/stocktake/new"><ClipboardCheck size={15}/> Bắt đầu kiểm kê</Link></div>
    <section className="metric-grid"><MetricCard label="Tổng SKU trong kho" value="1,842" foot="+24 sản phẩm trong tháng này" icon="box"/><MetricCard label="Sắp hết hàng" value="12" foot="Cần bổ sung trong tuần này" icon="alert"/><MetricCard label="Phiếu chờ xử lý" value="5" foot="3 phiếu nhập · 2 phiếu chuyển" icon="clock"/><MetricCard label="Giá trị tồn kho" value="4,82 tỷ" foot="Tại Kho trung tâm" icon="truck"/></section>
    <div className="dashboard-grid"><Panel title="Tồn kho cần chú ý" subtitle="Sản phẩm có số lượng thấp hoặc vừa hết hàng" action={<Link className="text-link" href="/inventory">Xem tất cả <ArrowRight size={13}/></Link>}>
        <div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm"/></label></div><InventoryTable rows={inventory}/>
      </Panel>
      <Panel title="Hoạt động gần đây" subtitle="Giao dịch mới nhất tại kho" action={<Link className="text-link" href="/history">Lịch sử <ArrowRight size={13}/></Link>}>
        <div className="activity-list"><Activity icon={<ArrowDownToLine size={15}/>} title="Phiếu nhập đã hoàn tất" detail="Nhập 12 sản phẩm · ASUS Việt Nam" code="PN-260927-03" time="09:42"/><Activity icon={<ArrowLeftRight size={15}/>} title="Phiếu chuyển đang giao" detail="Kho trung tâm → Kho Quận 1" code="CK-260927-02" time="09:15"/><Activity icon={<ClipboardCheck size={15}/>} title="Đã hoàn tất kiểm kê" detail="Khu vực A · Khớp 48/50 SKU" code="KK-260927-01" time="08:50"/><Activity icon={<Package size={15}/>} title="Xuất kho theo đơn hàng" detail="4 sản phẩm · Đơn #PH240931" code="XK-260927-08" time="08:22"/></div>
      </Panel></div>
    <div className="dashboard-grid lower-grid"><Panel title="Cần xử lý" subtitle="Các công việc đang chờ bạn" action={<StatusBadge value="5 việc"/>}>
        <div className="task-row"><TriangleAlert size={15}/><span><strong>3 phiếu nhập</strong> đang chờ xác nhận nhập kho</span><small>10:00 · hôm nay</small></div><div className="task-row"><TriangleAlert size={15}/><span><strong>2 phiếu chuyển</strong> chờ xác nhận giao hàng</span><small>11:30 · hôm nay</small></div><div className="task-row urgent"><TriangleAlert size={15}/><span><strong>12 sản phẩm</strong> dưới mức tồn tối thiểu</span><small>Cần bổ sung</small></div>
      </Panel><Panel title="Thao tác nhanh" subtitle="Truy cập các nghiệp vụ thường dùng"><div className="quick-link-grid"><Link href="/receipts"><span><ArrowDownToLine size={15}/></span>Nhận hàng nhập kho</Link><Link href="/transfers"><span><ArrowLeftRight size={15}/></span>Xử lý chuyển kho</Link><Link href="/stocktake"><span><ClipboardCheck size={15}/></span>Tạo phiên kiểm kê</Link><Link href="/history"><span><Clock3 size={15}/></span>Xem lịch sử giao dịch</Link></div></Panel></div>
  </>;
}

function InventoryTable({ rows }: { rows: DataRow[] }) { return <div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>VỊ TRÍ</th><th>TỒN HIỆN TẠI</th><th>MỨC TỐI THIỂU</th><th>TÌNH TRẠNG</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="product-cell"><span className="product-thumb"><Package size={16}/></span><span><strong>{row.name}</strong><small>{row.code}</small></span></span></td><td>{row.location}</td><td className="strong-value low-value">{row.quantity}</td><td>{row.minimum}</td><td><StatusBadge value={row.status}/></td></tr>)}</tbody></table></div>; }
function Activity({ icon, title, detail, code, time }: { icon: React.ReactNode; title: string; detail: string; code: string; time: string }) { return <div className="activity-item"><span className="activity-icon">{icon}</span><div className="activity-copy"><strong>{title}</strong><span>{detail}</span><small>{code}</small></div><time>{time}</time></div>; }

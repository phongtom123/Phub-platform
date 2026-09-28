import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, Package, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";

export function MetricCard({ label, value, foot, icon, href }: { label: string; value: string; foot: string; icon: "box" | "alert" | "clock" | "truck"; href?: string }) {
  const Icon = { box: Package, alert: AlertCircle, clock: Clock3, truck: Truck }[icon];
  const content = <><div className="metric-heading">{label}<span className={`metric-icon ${icon}`}><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></>;
  return href ? <Link href={href} className="metric-card metric-link">{content}</Link> : <article className="metric-card">{content}</article>;
}

export function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="panel-action">{action}</div>}</div>{children}</section>;
}

export function StatusBadge({ value }: { value: string | number }) {
  const text = String(value);
  const cls = ["Chờ xác nhận", "Đang soạn", "Đang chuyển", "Nháp"].includes(text) ? "warning" : ["Hết hàng"].includes(text) ? "danger" : ["Đã nhập", "Đã xuất", "Đã nhận", "Còn hàng", "Hoàn tất"].includes(text) ? "success" : "neutral";
  return <span className={`status-badge ${cls}`}><i />{text}</span>;
}

export function EmptyState({ text }: { text: string }) { return <div className="empty-state"><PackageCheck size={22}/><span>{text}</span></div>; }

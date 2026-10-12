import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, Package, PackageCheck, Truck } from "lucide-react";

export function MetricCard({ label, value, foot, icon }: { label: string; value: string; foot: string; icon: "box" | "alert" | "clock" | "truck" }) {
  const Icon = { box: Package, alert: AlertCircle, clock: Clock3, truck: Truck }[icon];
  return <article className="metric-card"><div className="metric-heading">{label}<span className={`metric-icon ${icon}`}><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></article>;
}

export function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="panel-action">{action}</div>}</div>{children}</section>;
}

export function StatusBadge({ value }: { value: string | number }) {
  const text = String(value);
  const cls = ["Sắp hết", "Chờ xác nhận", "Đang kiểm kê", "Đang chuyển", "Nháp"].includes(text) ? "warning" : ["Hết hàng"].includes(text) ? "danger" : ["Đã nhập", "Đã nhận", "Còn hàng", "Hoàn tất"].includes(text) ? "success" : "neutral";
  return <span className={`status-badge ${cls}`}><i />{text}</span>;
}

export function EmptyState({ text }: { text: string }) { return <div className="empty-state"><PackageCheck size={22}/><span>{text}</span></div>; }

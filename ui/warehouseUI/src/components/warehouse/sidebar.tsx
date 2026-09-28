"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, ArrowLeftRight, Boxes, ClipboardCheck, Clock3, LayoutDashboard, LogOut, Package, Settings, UserRound, Warehouse } from "lucide-react";
import type { ModuleKey } from "@/src/types/warehouse";
import type { WarehouseUser } from "@/src/types/warehouse-auth";

const workNav: { key: ModuleKey; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
  { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard }, { key: "inventory", label: "Tồn kho", icon: Boxes }, { key: "receipts", label: "Phiếu nhập", icon: ArrowDownToLine, count: 3 }, { key: "transfers", label: "Chuyển kho", icon: ArrowLeftRight, count: 2 }, { key: "stocktake", label: "Kiểm kê", icon: ClipboardCheck },
];
const lookupNav: { key: ModuleKey; label: string; icon: typeof Package }[] = [{ key: "products", label: "Sản phẩm", icon: Package }, { key: "history", label: "Lịch sử kho", icon: Clock3 }];

export default function Sidebar({ user, onLogout }: { user: WarehouseUser; onLogout: () => void }) {
  const pathname = usePathname();
  const active = pathname === "/" ? "dashboard" : pathname.split("/")[1] as ModuleKey;
  return <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark">P</span><span><strong>PHUB</strong><small>WAREHOUSE</small></span></Link>
    <div className="nav-label">LÀM VIỆC</div>{workNav.map(({ key, label, icon: Icon, count }) => <Link key={key} href={key === "dashboard" ? "/" : `/${key}`} className={`nav-item ${active === key ? "active" : ""}`}><Icon size={17}/><span>{label}</span>{count && <span className="nav-count">{count}</span>}</Link>)}
    <div className="nav-label lookup-label">TRA CỨU</div>{lookupNav.map(({ key, label, icon: Icon }) => <Link key={key} href={`/${key}`} className={`nav-item ${active === key ? "active" : ""}`}><Icon size={17}/><span>{label}</span></Link>)}
    <div className="nav-label lookup-label">CÁ NHÂN</div><Link href="/account" className={`nav-item ${active === "account" ? "active" : ""}`}><UserRound size={17}/><span>Tài khoản</span></Link><Link href="/settings" className={`nav-item ${active === "settings" ? "active" : ""}`}><Settings size={17}/><span>Cài đặt</span></Link>
    <div className="sidebar-bottom"><div className="warehouse-card"><div className="warehouse-label">KHO ĐANG LÀM VIỆC</div><strong><Warehouse size={14}/> Kho trung tâm</strong><span>Hôm nay · 27/09/2026</span></div><div className="sidebar-user"><span className="avatar">{user.initials}</span><span><strong>{user.name}</strong><small>Thủ kho · {user.employeeCode}</small></span><button type="button" className="user-logout" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={16}/></button></div></div>
  </aside>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Clock3, LayoutDashboard, Package, Settings, UserRound, Warehouse } from "lucide-react";
import type { ModuleKey } from "@/src/types/warehouse";
import type { WarehouseUser } from "@/src/types/warehouse-auth";
import { getReceipts, getTransfers } from "@/src/lib/warehouse-api";

const workNav: { key: ModuleKey; label: string; icon: typeof LayoutDashboard; countKey?: "receipts" | "transfers" }[] = [
  { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard }, { key: "inventory", label: "Tồn kho", icon: Boxes }, { key: "receipts", label: "Phiếu nhập", icon: ArrowDownToLine, countKey: "receipts" }, { key: "dispatches", label: "Phiếu xuất", icon: ArrowUpFromLine }, { key: "transfers", label: "Chuyển kho", icon: ArrowLeftRight, countKey: "transfers" },
];
const lookupNav: { key: ModuleKey; label: string; icon: typeof Package }[] = [{ key: "products", label: "Sản phẩm", icon: Package }, { key: "history", label: "Lịch sử kho", icon: Clock3 }];

export default function Sidebar({ user, onLogout }: { user: WarehouseUser; onLogout: () => void }) {
  const pathname = usePathname();
  const active = pathname === "/" ? "dashboard" : pathname.split("/")[1] as ModuleKey;
  const [counts, setCounts] = useState({ receipts: 0, transfers: 0 });
  useEffect(() => {
    let cancelled = false;
    Promise.all([getReceipts(), getTransfers()]).then(([receipts, transfers]) => {
      if (cancelled) return;
      setCounts({
        receipts: receipts.filter(item => ["Nháp", "Chờ xác nhận"].includes(String(item.status))).length,
        transfers: transfers.filter(item => ["Nháp", "Đang chuyển"].includes(String(item.status))).length,
      });
    }).catch(() => { /* The page content owns the visible API error state. */ });
    return () => { cancelled = true; };
  }, []);
  return <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark">P</span><span><strong>PHUB</strong><small>WAREHOUSE</small></span></Link>
    <div className="nav-label">LÀM VIỆC</div>{workNav.map(({ key, label, icon: Icon, countKey }) => <Link key={key} href={key === "dashboard" ? "/" : `/${key}`} className={`nav-item ${active === key ? "active" : ""}`}><Icon size={17}/><span>{label}</span>{countKey && counts[countKey] > 0 && <span className="nav-count">{counts[countKey]}</span>}</Link>)}
    <div className="nav-label lookup-label">TRA CỨU</div>{lookupNav.map(({ key, label, icon: Icon }) => <Link key={key} href={`/${key}`} className={`nav-item ${active === key ? "active" : ""}`}><Icon size={17}/><span>{label}</span></Link>)}
    <div className="nav-label lookup-label">CÁ NHÂN</div><Link href="/account" className={`nav-item ${active === "account" ? "active" : ""}`}><UserRound size={17}/><span>Tài khoản</span></Link><Link href="/settings" className={`nav-item ${active === "settings" ? "active" : ""}`}><Settings size={17}/><span>Cài đặt</span></Link>
    <div className="sidebar-bottom"><div className="warehouse-card"><div className="warehouse-label">KHO ĐANG LÀM VIỆC</div><strong><Warehouse size={14}/> Kho #{user.warehouseId ?? "—"}</strong><span>Phân công từ hệ thống</span></div><div className="sidebar-user"><span className="avatar">{user.name.split(" ").slice(-2).map(part => part[0]).join("")}</span><span><strong>{user.name}</strong><small>Thủ kho · {user.employeeCode}</small></span><button type="button" className="user-more" onClick={onLogout} aria-label="Đăng xuất">↪</button></div></div>
  </aside>;
}

"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  FileInput,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  Truck,
  UserCog,
  UserRound,
  Users,
  Warehouse,
  Waypoints,
  X,
} from "lucide-react";
import type { ModuleKey } from "@/src/types/admin";
import { Logo } from "./ui";

const navigation = [
  { label: "TỔNG QUAN", items: [["dashboard", "Tổng quan", LayoutDashboard]] },
  {
    label: "BÁN HÀNG",
    items: [
      ["orders", "Đơn hàng", ShoppingBag],
      ["billing", "Hóa đơn & thanh toán", CreditCard],
      ["customers", "Khách hàng", UserRound],
    ],
  },
  {
    label: "SẢN PHẨM",
    items: [
      ["products", "Sản phẩm", Package],
      ["categories", "Loại sản phẩm", FolderTree],
    ],
  },
  {
    label: "KHO HÀNG",
    items: [
      ["inventory", "Tồn kho", Warehouse],
      ["receipts", "Phiếu nhập", FileInput],
      ["transfers", "Chuyển kho", Waypoints],
      ["suppliers", "Nhà cung cấp", Truck],
    ],
  },
  {
    label: "TỔ CHỨC",
    items: [
      ["branches", "Kho", Building2],
      ["employees", "Nhân viên", UserCog],
      ["accounts", "Tài khoản", Users],
    ],
  },
  {
    label: "TIẾP THỊ",
    items: [
      ["promotions", "Khuyến mãi", Sparkles],
      ["vouchers", "Voucher", TicketPercent],
    ],
  },
] as const;

type Props = {
  active: ModuleKey;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (key: ModuleKey) => void;
  onCloseMobile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function AdminSidebar({
  active,
  collapsed,
  mobileOpen,
  onNavigate,
  onCloseMobile,
  onOpenSettings,
  onLogout,
}: Props) {
  const activeGroup =
    navigation.find((group) => group.items.some(([key]) => key === active))
      ?.label ?? "TỔNG QUAN";
  const [expandedGroups, setExpandedGroups] = useState<string[]>([activeGroup]);
  useEffect(
    () =>
      setExpandedGroups((groups) =>
        groups.includes(activeGroup) ? groups : [...groups, activeGroup],
      ),
    [activeGroup],
  );
  const toggle = (label: string) =>
    setExpandedGroups((groups) =>
      groups.includes(label)
        ? groups.filter((item) => item !== label)
        : [...groups, label],
    );
  const navigate = (key: ModuleKey) => {
    onNavigate(key);
    onCloseMobile();
  };

  return (
    <>
      <aside
        className={`sidebar ${mobileOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
      >
        <div className="side-logo">
          <Logo onClick={() => navigate("dashboard")} />
          <button onClick={onCloseMobile}>
            <X />
          </button>
        </div>
        <nav>
          {navigation.map((group) => {
            const expanded = expandedGroups.includes(group.label);
            return (
              <section className="nav-section" key={group.label}>
                <button
                  className="nav-group-toggle"
                  onClick={() => toggle(group.label)}
                >
                  <span>{group.label}</span>
                  <ChevronDown className={expanded ? "rotated" : ""} />
                </button>
                <div className={`nav-items ${expanded ? "expanded" : ""}`}>
                  {group.items.map(([key, label, Icon]) => (
                    <button
                      key={key}
                      title={collapsed ? label : undefined}
                      className={active === key ? "active" : ""}
                      onClick={() => navigate(key)}
                    >
                      <Icon />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
        <div className="side-bottom">
          <button onClick={onOpenSettings}>
            <Settings />
            <span>Cài đặt</span>
          </button>
          <button onClick={onLogout}>
            <LogOut />
            <span>Đăng xuất</span>
          </button>
          <div className="branch">
            <b>
              AD
              <i />
            </b>
            <p>
              <small>PHẠM VI QUẢN TRỊ</small>
              <strong>Toàn hệ thống</strong>
            </p>
            <ChevronDown />
          </div>
        </div>
      </aside>
      {mobileOpen && <div className="shade" onClick={onCloseMobile} />}
    </>
  );
}

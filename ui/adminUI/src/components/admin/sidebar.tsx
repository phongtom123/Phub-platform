"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  BarChart3,
  ChevronDown,
  CreditCard,
  FileInput,
  FileOutput,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  MessageSquare,
  Truck,
  UserCog,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import type { ModuleKey } from "@internal/types/admin";
import { Logo } from "./ui";
import { canOpenModule } from "../../../../shared/internal-access";
import { useAdminAuth } from "./auth-provider";

const navigation = [
  { label: "TỔNG QUAN", items: [["dashboard", "Tổng quan", LayoutDashboard], ["reports", "Báo cáo kinh doanh", BarChart3]] },
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
      ["dispatches", "Phiếu xuất", FileOutput],
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
      ["support", "Hỗ trợ khách hàng", MessageSquare],
      ["surveys", "Khảo sát khách hàng", TicketPercent],
      ["reviews", "Đánh giá sản phẩm", Sparkles],
      ["crmReport", "Báo cáo CRM", BarChart3],
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
  const { portal } = useAdminAuth();
  const router = useRouter();
  const visibleNavigation = navigation.map(group => ({ ...group,
    items: group.items.filter(([key]) => canOpenModule(portal, key)),
  })).filter(group => group.items.length);
  const activeGroup =
    visibleNavigation.find((group) => group.items.some(([key]) => key === active))
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
          <Logo label={portal === "admin" ? "admin" : "nhân viên"} onClick={() => navigate(portal === "admin" ? "dashboard" : "orders")} />
          <button onClick={onCloseMobile}>
            <X />
          </button>
        </div>
        <nav>
          {portal === "staff" && <section className="nav-section"><div className="nav-items expanded"><button onClick={() => { router.push("/counter"); onCloseMobile(); }}><CreditCard/><span>Bán tại quầy</span></button><button onClick={() => { router.push("/invoice-claims"); onCloseMobile(); }}><CreditCard/><span>Liên kết hóa đơn</span></button><button onClick={() => { router.push("/history"); onCloseMobile(); }}><Warehouse/><span>Lịch sử kho</span></button></div></section>}
          {visibleNavigation.map((group) => {
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
                      <span>{key === "surveys" && portal === "admin" ? "Kết quả khảo sát" : label}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
        <div className="side-bottom">
          {portal === "staff" && <button onClick={onOpenSettings}>
            <Settings />
            <span>Cài đặt</span>
          </button>}
          <button onClick={onLogout}>
            <LogOut />
            <span>Đăng xuất</span>
          </button>
          <div className="branch">
            <b>
              {portal === "admin" ? "AD" : "NV"}
              <i />
            </b>
            <p>
              <small>{portal === "admin" ? "QUẢN TRỊ" : "NGHIỆP VỤ"}</small>
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

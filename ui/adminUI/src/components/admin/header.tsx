"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import type { ModuleKey } from "@/src/types/admin";
import { getModuleHref } from "@/src/lib/admin-navigation";
import { DataBreadcrumb } from "./data-breadcrumb";

type Props = {
  dataResource?: string;
  user: { name: string; username: string } | null;
  onGoProfile: () => void;
  activeModule: ModuleKey;
  title: string;
  onToggleSidebar: () => void;
  onNavigate: (moduleKey: ModuleKey) => void;
  onGoAccounts: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function AdminHeader({
  dataResource,
  user,
  onGoProfile,
  activeModule,
  title,
  onToggleSidebar,
  onNavigate,
  onGoAccounts,
  onOpenSettings,
  onLogout,
}: Props) {
  const initials = user?.name.split(/\s+/).filter(Boolean).slice(-2).map(word => word[0]).join("").toUpperCase() || "AD";
  const [panel, setPanel] = useState<"notifications" | "account" | null>(null);
  const followModuleLink = (
    event: MouseEvent<HTMLAnchorElement>,
    moduleKey: ModuleKey,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onNavigate(moduleKey);
  };

  return (
    <header className="topbar">
      <button className="hamb" onClick={onToggleSidebar}>
        <Menu />
      </button>
      {dataResource ? <DataBreadcrumb resource={dataResource} /> : <nav className="crumb" aria-label="Breadcrumb">
        <Link
          href={getModuleHref("dashboard")}
          onClick={(event) => followModuleLink(event, "dashboard")}
        >
          Quản trị
        </Link>
        <ChevronRight />
        <Link
          className="current"
          aria-current="page"
          href={getModuleHref(activeModule)}
          onClick={(event) => followModuleLink(event, activeModule)}
        >
          {title}
        </Link>
      </nav>}
      <div className="top-actions">
        <label>
          <Search />
          <input placeholder="Tìm kiếm nhanh..." />
          <kbd>⌘ K</kbd>
        </label>
        <div className="header-popup-wrap">
          <button
            className={`bell ${panel === "notifications" ? "pressed" : ""}`}
            onClick={() =>
              setPanel(panel === "notifications" ? null : "notifications")
            }
          >
            <Bell />
          </button>
          {panel === "notifications" && (
            <NotificationPanel
              onClose={() => setPanel(null)}
              onGoAccounts={onGoAccounts}
            />
          )}
        </div>
        <div className="header-popup-wrap">
          <button
            className={`user ${panel === "account" ? "pressed" : ""}`}
            onClick={() => setPanel(panel === "account" ? null : "account")}
          >
            <b>{initials}</b>
            <span className="user-copy">
              <strong>{user?.name ?? "Quản trị viên"}</strong>
              <small>Quản trị viên</small>
            </span>
            <ChevronDown />
          </button>
          {panel === "account" && (
            <AccountPanel
              user={user}
              initials={initials}
              onGoProfile={onGoProfile}
              onClose={() => setPanel(null)}
              onGoAccounts={onGoAccounts}
              onOpenSettings={onOpenSettings}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void; onGoAccounts: () => void }) {
  return <section className="header-popup notifications-popup">
    <header><b>Thông báo</b><button onClick={onClose} aria-label="Đóng thông báo"><X /></button></header>
    <p style={{ padding: 16 }}>Chưa kết nối API thông báo.</p>
  </section>;
}

function AccountPanel({
  user,
  initials,
  onGoProfile,
  onClose,
  onGoAccounts,
  onOpenSettings,
  onLogout,
}: {
  user: { name: string; username: string } | null;
  initials: string;
  onGoProfile: () => void;
  onClose: () => void;
  onGoAccounts: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  const run = (action: () => void) => {
    onClose();
    action();
  };
  return (
    <section className="header-popup account-popup">
      <div className="account-summary">
        <b>{initials}</b>
        <p>
          <strong>{user?.name ?? "Quản trị viên"}</strong>
          <small>{user?.username}</small>
          <span>ADMIN · Toàn hệ thống</span>
        </p>
      </div>
      <nav>
        <button onClick={() => run(onGoProfile)}><UserRound /> Tài khoản của tôi</button>
        <button onClick={() => run(onGoAccounts)}>
          <UserRound /> Quản lý tài khoản
        </button>
        <button onClick={() => run(onOpenSettings)}>
          <Settings /> Cài đặt hệ thống
        </button>
        <button className="logout-item" onClick={() => run(onLogout)}>
          <LogOut /> Đăng xuất
        </button>
      </nav>
    </section>
  );
}

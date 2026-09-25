"use client";

import { useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingBag,
  UserRound,
  Users,
  X,
} from "lucide-react";

type Props = {
  title: string;
  onToggleSidebar: () => void;
  onGoHome: () => void;
  onGoAccounts: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function AdminHeader({
  title,
  onToggleSidebar,
  onGoHome,
  onGoAccounts,
  onOpenSettings,
  onLogout,
}: Props) {
  const [panel, setPanel] = useState<"notifications" | "account" | null>(null);
  return (
    <header className="topbar">
      <button className="hamb" onClick={onToggleSidebar}>
        <Menu />
      </button>
      <nav className="crumb">
        <button onClick={onGoHome}>Quản trị</button>
        <ChevronRight />
        <button
          className="current"
          onClick={title === "Tổng quan" ? undefined : onGoHome}
        >
          {title}
        </button>
      </nav>
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
            <i />
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
            <b>NT</b>
            <span className="user-copy">
              <strong>Minh Thịnh</strong>
              <small>Quản trị viên</small>
            </span>
            <ChevronDown />
          </button>
          {panel === "account" && (
            <AccountPanel
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

function NotificationPanel({
  onClose,
  onGoAccounts,
}: {
  onClose: () => void;
  onGoAccounts: () => void;
}) {
  return (
    <section className="header-popup notifications-popup">
      <header>
        <div>
          <b>Thông báo</b>
          <span>3 thông báo mới</span>
        </div>
        <button onClick={onClose}>
          <X />
        </button>
      </header>
      <div className="notification-list">
        <button
          onClick={() => {
            onClose();
            onGoAccounts();
          }}
        >
          <span className="notice-icon">
            <Users />
          </span>
          <span className="notice-copy">
            <b>Tài khoản cần kiểm tra</b>
            <small>Một tài khoản khách hàng vừa bị tạm khóa.</small>
            <em>5 phút trước</em>
          </span>
        </button>
        <button onClick={onClose}>
          <span className="notice-icon warning">
            <Package />
          </span>
          <span className="notice-copy">
            <b>12 sản phẩm sắp hết</b>
            <small>Tồn kho đã xuống dưới mức cảnh báo.</small>
            <em>32 phút trước</em>
          </span>
        </button>
        <button onClick={onClose}>
          <span className="notice-icon order">
            <ShoppingBag />
          </span>
          <span className="notice-copy">
            <b>Có 4 đơn hàng mới</b>
            <small>Đơn hàng đang chờ xác nhận.</small>
            <em>1 giờ trước</em>
          </span>
        </button>
      </div>
      <footer>
        <button onClick={onClose}>Đánh dấu tất cả đã đọc</button>
      </footer>
    </section>
  );
}

function AccountPanel({
  onClose,
  onGoAccounts,
  onOpenSettings,
  onLogout,
}: {
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
        <b>NT</b>
        <p>
          <strong>Nguyễn Minh Thịnh</strong>
          <small>thinh@phub.vn</small>
          <span>ADMIN · Toàn hệ thống</span>
        </p>
      </div>
      <nav>
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

"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Sidebar from "@/src/components/warehouse/sidebar";
import Header from "@/src/components/warehouse/header";
import type { WarehouseUser } from "@/src/types/warehouse-auth";

const warehouseSessionKey = "phub-warehouse-user";
const adminLoginUrl =
  process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";

const warehouseUsers: Record<string, WarehouseUser> = {
  "phong.kho": {
    username: "phong.kho",
    name: "Trần Đức Phong",
    initials: "TP",
    employeeCode: "NV002",
  },
};

export default function WarehouseFrame({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WarehouseUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    const access = url.searchParams.get("access");
    const staff = url.searchParams.get("staff") ?? "";
    const handedOffUser = access === "warehouse-demo" ? warehouseUsers[staff] : undefined;

    if (handedOffUser) {
      window.sessionStorage.setItem(
        warehouseSessionKey,
        JSON.stringify(handedOffUser),
      );
      url.searchParams.delete("access");
      url.searchParams.delete("staff");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setUser(handedOffUser);
      setCheckingSession(false);
      return;
    }

    const storedUser = window.sessionStorage.getItem(warehouseSessionKey);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as WarehouseUser);
        setCheckingSession(false);
        return;
      } catch {
        window.sessionStorage.removeItem(warehouseSessionKey);
      }
    }

    window.location.replace(adminLoginUrl);
  }, []);

  if (checkingSession || !user) {
    return <main className="auth-loading">Đang kiểm tra quyền truy cập kho…</main>;
  }

  const logout = () => {
    window.sessionStorage.removeItem(warehouseSessionKey);
    window.location.assign(adminLoginUrl);
  };

  return <div className="app-shell"><Sidebar user={user} onLogout={logout}/><div className="main-shell"><Header user={user}/><main className="main-content">{children}<footer className="app-footer">PHUB Warehouse · Giao diện quản lý kho nội bộ</footer></main></div></div>;
}

"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Sidebar from "@/src/components/warehouse/sidebar";
import Header from "@/src/components/warehouse/header";
import type { WarehouseUser } from "@/src/types/warehouse-auth";

const adminLoginUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";

export default function WarehouseFrame({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WarehouseUser | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/auth/me", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.status === 401) { window.location.replace(adminLoginUrl); return; }
      const account = await response.json();
      if (!response.ok) throw new Error(typeof account.detail === "string" ? account.detail : "Không kiểm tra được phiên đăng nhập.");
      if (account.role !== "THU_KHO") { window.location.replace(adminLoginUrl); return; }
      setUser({ username: account.username, name: account.name, employeeCode: account.employee_id,
        initials: String(account.name).split(" ").slice(-2).map((part: string) => part[0]).join("") });
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);

  if (!user) return <main className="auth-loading">{error || "Đang kiểm tra quyền truy cập kho…"}{error && <p><a href={adminLoginUrl}>Quay lại đăng nhập</a></p>}</main>;
  const logout = async () => {
    const response = await fetch("/api/backend/auth/logout", { method: "POST" });
    if (!response.ok) { window.alert("Không đăng xuất được. Thử lại sau."); return; }
    window.location.assign(adminLoginUrl);
  };
  return <div className="app-shell"><Sidebar user={user} onLogout={logout} /><div className="main-shell"><Header user={user} /><main className="main-content">{children}<footer className="app-footer">PHUB Warehouse · Dữ liệu theo kho được phân công</footer></main></div></div>;
}

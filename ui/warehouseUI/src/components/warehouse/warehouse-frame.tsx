"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Sidebar from "@/src/components/warehouse/sidebar";
import Header from "@/src/components/warehouse/header";
import type { WarehouseUser } from "@/src/types/warehouse-auth";
import { AuthRequestError, getSession, logoutSession } from "../../../../shared/auth-client";

const adminLoginUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000";

export default function WarehouseFrame({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WarehouseUser | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal).then(account => {
      if (account.role !== "NHAN_VIEN_KHO" || !account.employee_id || account.warehouse_id === null) {
        window.location.replace(adminLoginUrl);
        return;
      }
      setUser({ username: account.username, name: account.name, employeeCode: account.employee_id,
        initials: String(account.name).split(" ").slice(-2).map((part: string) => part[0]).join(""), warehouseId: account.warehouse_id });
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err instanceof AuthRequestError && err.status === 401) { window.location.replace(adminLoginUrl); return; }
      setError(err instanceof Error ? err.message : "Không kiểm tra được phiên đăng nhập.");
    });
    return () => controller.abort();
  }, []);

  if (!user) return <main className="auth-loading">{error || "Đang kiểm tra quyền truy cập kho…"}{error && <p><a href={adminLoginUrl}>Quay lại đăng nhập</a></p>}</main>;
  const logout = async () => {
    try { await logoutSession(); }
    catch { window.alert("Không đăng xuất được. Thử lại sau."); return; }
    window.location.assign(adminLoginUrl);
  };
  return <div className="app-shell"><Sidebar user={user} onLogout={logout} /><div className="main-shell"><Header user={user} /><main className="main-content">{children}<footer className="app-footer">PHUB Warehouse · Dữ liệu theo kho được phân công</footer></main></div></div>;
}

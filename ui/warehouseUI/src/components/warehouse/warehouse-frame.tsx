"use client";

import type { ReactNode } from "react";
import Sidebar from "@/src/components/warehouse/sidebar";
import Header from "@/src/components/warehouse/header";
import { useEffect, useState } from "react";
import type { WarehouseUser } from "@/src/types/warehouse-auth";

export default function WarehouseFrame({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WarehouseUser | null>(null); const [error, setError] = useState("");
  useEffect(() => { const preview = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("preview") === "1"; if (preview) { setUser({ username: "preview", role: "NHAN_VIEN", name: "Xem giao diện", employeeCode: "NV-DEMO", warehouseId: 1 }); return; } const controller = new AbortController(); fetch("/api/backend/auth/me", { cache: "no-store", credentials: "include", signal: controller.signal }).then(async response => { const body = await response.json().catch(() => ({})); if (response.status === 401) { window.location.replace("/login"); return; } if (!response.ok) throw new Error(body.detail || "Không kiểm tra được phiên đăng nhập."); if (!["NHAN_VIEN", "NHAN_VIEN_KHO"].includes(body.role)) throw new Error("Tài khoản không có quyền nhân viên kho."); setUser({ username: body.username, role: body.role, name: body.name, employeeCode: body.employee_id, warehouseId: body.warehouse_id }); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }); return () => controller.abort(); }, []);
  if (!user) return <main className="auth-loading">{error || "Đang kiểm tra quyền truy cập kho…"}{error && <p><a href="/login">Quay lại đăng nhập</a></p>}</main>;
  async function logout() { const response = await fetch("/api/backend/auth/logout", { method: "POST", credentials: "include" }); if (response.ok) window.location.assign("/login"); }
  return <div className="app-shell"><Sidebar user={user} onLogout={logout}/><div className="main-shell"><Header user={user}/><main className="main-content">{children}<footer className="app-footer">PHUB Warehouse · Dữ liệu tổng hợp tất cả kho</footer></main></div></div>;
}

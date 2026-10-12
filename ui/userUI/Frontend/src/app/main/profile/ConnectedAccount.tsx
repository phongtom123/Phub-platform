"use client";

import { useEffect, useState } from "react";
import BackendDataView from "@/components/BackendDataView";

type Account = { role: string; name: string };
const tabs = [{ id: "customers", label: "Thông tin của tôi" }, { id: "orders", label: "Đơn hàng của tôi" }, { id: "invoices", label: "Hóa đơn" }, { id: "payments", label: "Thanh toán" }];

export default function ConnectedAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("customers");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/auth/me", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Không kiểm tra được tài khoản.");
      if (body.role !== "KHACH_HANG") throw new Error("Trang này dành cho tài khoản khách hàng.");
      setAccount(body);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);
  const logout = async () => {
    const response = await fetch("/api/backend/auth/logout", { method: "POST" });
    if (response.ok) window.location.assign("/auth/login");
    else setError("Không đăng xuất được. Thử lại sau.");
  };
  return <section className="live-data">{error && <p role="alert" className="live-error">{error} <a href="/auth/login">Đăng nhập</a></p>}{!account && !error && <p>Đang tải tài khoản…</p>}{account && <><h2>{account.name}</h2><div className="live-tools">{tabs.map(item => <button aria-pressed={tab === item.id} className={tab === item.id ? "live-primary" : ""} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>)}<button onClick={logout}>Đăng xuất</button></div><BackendDataView key={tab} resource={tab} /></>}</section>;
}

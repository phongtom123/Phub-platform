"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackendDataView from "@/components/BackendDataView";
import { getSession, logoutSession, type SessionUser } from "../../../../../../shared/auth-client";

const tabs = [{ id: "customers", label: "Thông tin của tôi" }, { id: "orders", label: "Đơn hàng của tôi" }, { id: "invoices", label: "Hóa đơn" }, { id: "payments", label: "Thanh toán" }];

export default function ConnectedAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("customers");
  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal).then(body => {
      if (body.role !== "KHACH_HANG") throw new Error("Trang này dành cho tài khoản khách hàng.");
      setAccount(body);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);
  const logout = async () => {
    try { await logoutSession(); router.push("/auth/login"); router.refresh(); }
    catch { setError("Không đăng xuất được. Thử lại sau."); }
  };
  return <section className="live-data">{error && <p role="alert" className="live-error">{error} <Link href="/auth/login">Đăng nhập</Link></p>}{!account && !error && <p>Đang tải tài khoản…</p>}{account && <><h2>{account.name}</h2><div className="live-tools">{tabs.map(item => <button aria-pressed={tab === item.id} className={tab === item.id ? "live-primary" : ""} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>)}<button onClick={logout}>Đăng xuất</button></div><BackendDataView key={tab} resource={tab} /></>}</section>;
}

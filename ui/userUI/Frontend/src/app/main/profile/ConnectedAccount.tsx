"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { AccountAccessContext } from "@/lib/account/useAccountResource";
import { AUTH_SESSION_EVENT, getSession, logoutSession, type SessionUser } from "../../../../../../shared/auth-client";
import { AccountDashboard } from "./AccountDashboard";
import styles from "./profile.module.css";

export default function ConnectedAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const denyAccess = useCallback((message: string) => { setAccount(null); setError(message); }, []);
  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal).then(user => {
      if (controller.signal.aborted) return;
      if (user.role !== "KHACH_HANG") { denyAccess("Trang này dành cho tài khoản khách hàng."); return; }
      setAccount(user); setError("");
    }).catch(err => { if (!controller.signal.aborted) denyAccess(err.message); });
    return () => controller.abort();
  }, [version, denyAccess]);
  useEffect(() => {
    const refresh = () => { setAccount(null); setError(""); setVersion(value => value + 1); };
    window.addEventListener(AUTH_SESSION_EVENT, refresh);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, refresh);
  }, []);
  async function logout() {
    setLoggingOut(true); setLogoutError("");
    try { await logoutSession(); setAccount(null); router.push("/auth/login"); router.refresh(); }
    catch { setLogoutError("Không đăng xuất được. Vui lòng thử lại."); }
    finally { setLoggingOut(false); }
  }
  if (!account) return <section className={styles.gate} aria-label="Truy cập tài khoản">
    {error ? <><h2>Không thể mở tài khoản</h2><p role="alert">{error}</p><div className={styles.actions}><Link href="/auth/login">Đăng nhập</Link><Button variant="outline" onClick={() => { setError(""); setVersion(value => value + 1); }}>Thử lại</Button></div></> : <p role="status">Đang xác thực tài khoản…</p>}
  </section>;
  return <AccountAccessContext.Provider value={denyAccess}><AccountDashboard key={`${account.account_id}:${version}`} account={account} logout={logout} loggingOut={loggingOut} logoutError={logoutError} /></AccountAccessContext.Provider>;
}

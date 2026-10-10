"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/src/lib/warehouse-api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try { const account = await login(username, password); if (account.role !== "THU_KHO") throw new Error("Tài khoản không có quyền thủ kho."); router.replace("/"); }
    catch (err) { setError(err instanceof Error ? err.message : "Đăng nhập thất bại."); }
    finally { setLoading(false); }
  }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="brand auth-brand"><span className="brand-mark">P</span><span><strong>PHUB</strong><small>WAREHOUSE</small></span></div>
    <h1>Đăng nhập kho</h1><p>Đăng nhập bằng tài khoản nhân viên được phân công kho.</p>
    <label><span>Tên tài khoản hoặc email</span><input required value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" /></label>
    <label><span>Mật khẩu</span><input required type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></label>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="button primary auth-submit" disabled={loading}>{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
  </form></main>;
}

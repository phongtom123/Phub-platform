"use client";

import { useState, type FormEvent } from "react";
import { useAdminAuth } from "@internal/components/admin/auth-provider";

export default function StaffProfile() {
  const { user } = useAdminAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const password = String(form.get("new_password"));
    if (password !== form.get("confirmation")) { setError("Hai mật khẩu không khớp."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/backend/auth/me/password", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: String(form.get("current_password")), new_password: password }) });
      if (!response.ok) { const body = await response.json(); throw new Error(typeof body.detail === "string" ? body.detail : "Không đổi được mật khẩu."); }
      window.location.replace("/login?passwordChanged=1");
    } catch (err) { setError(err instanceof Error ? err.message : "Không kết nối được API."); }
    finally { setBusy(false); }
  }
  return <section><h2>Tài khoản của tôi</h2><p className="live-note">{user?.name} · {user?.username} · {user?.employee_id}</p><form className="live-form" onSubmit={submit}><h3 className="account-wide">Đổi mật khẩu</h3><label>Mật khẩu hiện tại<input type="password" name="current_password" autoComplete="current-password" required /></label><label>Mật khẩu mới<input type="password" name="new_password" autoComplete="new-password" minLength={10} maxLength={128} required /></label><label>Nhập lại mật khẩu<input type="password" name="confirmation" autoComplete="new-password" minLength={10} maxLength={128} required /></label>{error && <p className="live-error" role="alert">{error}</p>}<div className="live-form-actions"><button disabled={busy} className="live-primary">{busy ? "Đang lưu…" : "Đổi mật khẩu"}</button></div></form></section>;
}

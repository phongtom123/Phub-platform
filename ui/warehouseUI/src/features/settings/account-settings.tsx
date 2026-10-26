"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "@warehouse/src/components/warehouse/ui";

type Session = { name: string; username: string; employee_id: string | null; role: string; warehouse_id: number | null };
export default function AccountSettings({ section }: { section: "account" | "settings" }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (section !== "account") return;
    const controller = new AbortController();
    fetch("/api/backend/auth/me", { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Không tải được tài khoản."); return body; })
      .then(body => { if (!controller.signal.aborted) setSession(body); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [section]);
  if (section === "settings") return <Panel title="Cài đặt" subtitle="Thiết lập phiên làm việc"><p>Kho làm việc lấy từ phân quyền thực tế của tài khoản và không thể tự đổi tại đây.</p></Panel>;
  async function changePassword(event: FormEvent) {
    event.preventDefault(); setError("");
    if (newPassword !== confirmPassword) { setError("Mật khẩu mới và xác nhận chưa khớp."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/backend/auth/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Không đổi được mật khẩu.");
      window.location.assign("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Không đổi được mật khẩu."); setSaving(false); }
  }
  return <Panel title="Tài khoản của tôi" subtitle="Thông tin từ phiên đăng nhập" className="account-panel">
    {error && <p role="alert">{error}</p>}
    {!session && !error && <p role="status">Đang tải tài khoản…</p>}
    {session && <dl className="account-details">
      <div><dt>Họ tên</dt><dd>{session.name}</dd></div>
      <div><dt>Tên đăng nhập</dt><dd>{session.username}</dd></div>
      <div><dt>Mã nhân viên</dt><dd>{session.employee_id ?? "Chưa được gán"}</dd></div>
      <div><dt>Vai trò</dt><dd>{session.role}</dd></div>
      <div><dt>Mã kho được phân công</dt><dd>{session.warehouse_id ?? "Chưa được phân công"}</dd></div>
    </dl>}
    <form className="password-form" onSubmit={changePassword}>
      <h3>Đổi mật khẩu</h3>
      <input type="password" required minLength={1} autoComplete="current-password" placeholder="Mật khẩu hiện tại" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
      <input type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="Mật khẩu mới (tối thiểu 10 ký tự)" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
      <input type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
      <button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Đổi mật khẩu"}</button>
    </form>
  </Panel>;
}

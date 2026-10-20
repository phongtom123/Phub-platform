"use client";

import { useState, type FormEvent } from "react";
import { accountApi, errorMessage, jsonRequest } from "./api";
import { roleLabels, type Account } from "./types";

export function AccountProfile({ account, onChange }: { account: Account; onChange: (account: Account) => void }) {
  const [username, setUsername] = useState(account.ten_tai_khoan);
  const [email, setEmail] = useState(account.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const saved = await accountApi<Account>("me", jsonRequest("PATCH", { ten_tai_khoan: username.trim(), email: email.trim() || null }));
      onChange(saved); window.dispatchEvent(new Event("phub-account-updated")); setNotice("Đã lưu thông tin đăng nhập.");
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (password !== confirmation) { setError("Hai mật khẩu không khớp."); return; }
    setBusy(true);
    try {
      await accountApi<Account>("me/password", jsonRequest("POST", { current_password: currentPassword, password }));
      setCurrentPassword(""); setPassword(""); setConfirmation("");
      window.location.assign("/?passwordChanged=1");
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <>
    <p className="live-note">{account.ho_ten} · {roleLabels[account.role]} · {account.ma_tk}</p>
    {error && <p role="alert" className="live-error">{error}</p>}{notice && <p role="status" className="live-note">{notice}</p>}
    <form className="live-form" onSubmit={saveProfile}>
      <label>Tên đăng nhập *<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" value={username} onChange={e => setUsername(e.target.value)} /></label>
      <label>Email<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div className="live-form-actions"><button className="live-primary" disabled={busy}>Lưu thông tin</button></div>
    </form>
    <form className="live-form account-section" onSubmit={changePassword}>
      <h3 className="account-wide">Đổi mật khẩu của tôi</h3>
      <label>Mật khẩu hiện tại *<input type="password" required autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
      <label>Mật khẩu mới *<input type="password" required autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>Nhập lại mật khẩu mới *<input type="password" required autoComplete="new-password" minLength={10} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      <p className="account-wide account-help">Đổi mật khẩu thành công sẽ đăng xuất bạn và làm các phiên cũ hết hiệu lực.</p>
      <div className="live-form-actions"><button className="live-primary" disabled={busy}>Đổi mật khẩu</button></div>
    </form>
  </>;
}

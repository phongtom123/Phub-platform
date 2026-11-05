"use client";

import { useEffect, useState } from "react";
import { Bell, Building2, Check, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Panel } from "@/src/components/warehouse/ui";
import { changeMyPassword } from "@/src/lib/warehouse-api";

export default function AccountSettings({ section }: { section: "account" | "settings" }) {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<{ username: string; email?: string | null; role: string; name: string; employee_id: string; warehouse_id: number | null } | null>(null);
  const [profileError, setProfileError] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [transferAlerts, setTransferAlerts] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const isAccount = section === "account";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("phub:warehouse:default");
    setEmailAlerts(window.localStorage.getItem("phub:warehouse:email-alerts") !== "false");
    setTransferAlerts(window.localStorage.getItem("phub:warehouse:transfer-alerts") !== "false");
  }, []);

  useEffect(() => {
    if (!isAccount) return;
    const controller = new AbortController();
    fetch("/api/backend/auth/me", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "Không tải được thông tin tài khoản.");
        setProfile(body);
      })
      .catch(error => { if (!controller.signal.aborted) setProfileError(error instanceof Error ? error.message : "Không tải được thông tin tài khoản."); });
    return () => controller.abort();
  }, [isAccount]);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAccount && typeof window !== "undefined") {
      window.localStorage.setItem("phub:warehouse:email-alerts", String(emailAlerts));
      window.localStorage.setItem("phub:warehouse:transfer-alerts", String(transferAlerts));
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    if (newPassword.length < 10) { setPasswordMessage("Mật khẩu mới phải có ít nhất 10 ký tự."); return; }
    setPasswordSaving(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setPasswordMessage("Đã đổi mật khẩu. Đang chuyển về trang đăng nhập…");
      window.setTimeout(() => window.location.assign("/login"), 900);
    } catch (error) { setPasswordMessage(error instanceof Error ? error.message : "Không thể đổi mật khẩu."); }
    finally { setPasswordSaving(false); }
  }

  return <>
    <div className="page-heading"><div><h1>{isAccount ? "Tài khoản của tôi" : "Cài đặt"}</h1></div></div>
    {isAccount ? <div className="account-layout">
      <Panel title="Thông tin cá nhân" subtitle="Thông tin liên hệ của tài khoản nhân viên">
        {profileError && <div className="module-note">{profileError}</div>}
        {!profile && !profileError && <div className="module-note">Đang tải thông tin tài khoản…</div>}
        {profile && <div className="account-form">
          <div className="profile-banner"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><div><strong>{profile.name}</strong><small>{profile.role === "NHAN_VIEN_KHO" ? "Nhân viên kho" : profile.role} · {profile.employee_id}</small></div><span className="active-pill"><i/> Đang hoạt động</span></div>
          <div className="form-grid"><label><span>Họ và tên</span><input value={profile.name} readOnly/></label><label><span>Mã nhân viên</span><input value={profile.employee_id} readOnly/></label><label><span>Tên tài khoản</span><input value={profile.username} readOnly/></label><label><span>Email</span><input value={profile.email ?? "—"} readOnly/></label><label><span>Kho phụ trách</span><input value={profile.warehouse_id == null ? "Chưa phân công" : `Kho #${profile.warehouse_id}`} readOnly/></label></div>
          <div className="module-note">Thông tin hồ sơ và phân công được quản lý bởi quản trị viên.</div>
        </div>}
      </Panel>
      <Panel title="Quyền và phân công" subtitle="Thông tin vai trò hiện tại">
        <div className="access-list"><div><ShieldCheck size={17}/><span><small>VAI TRÒ</small><strong>NHAN_VIEN_KHO · Nhân viên kho</strong></span></div><div><Building2 size={17}/><span><small>PHẠM VI XEM</small><strong>Tất cả kho · Chỉ đọc</strong></span></div><div><UserRound size={17}/><span><small>CHI NHÁNH</small><strong>Trung tâm phân phối PHUB</strong></span></div></div>
        <div className="module-note"><span>i</span>Quyền truy cập do quản trị viên cấp. Liên hệ quản trị viên nếu cần thay đổi vai trò hoặc kho được phân công.</div>
      </Panel>
      <Panel title="Bảo mật tài khoản" subtitle="Cài đặt bảo vệ tài khoản">
        <div className="security-row"><span className="security-icon"><LockKeyhole size={16}/></span><div><strong>Mật khẩu</strong><small>Được quản lý bởi hệ thống đăng nhập</small></div><span className="security-status">Đang bảo vệ</span></div>
        <form className="account-form" onSubmit={changePassword}><div className="form-grid"><label><span>Mật khẩu hiện tại</span><input required type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}/></label><label><span>Mật khẩu mới</span><input required minLength={10} type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)}/></label></div>{passwordMessage && <div className="module-note">{passwordMessage}</div>}<div className="form-actions"><button className="button primary" type="submit" disabled={passwordSaving}>{passwordSaving ? "Đang cập nhật…" : "Đổi mật khẩu"}</button></div></form>
        <div className="security-row"><span className="security-icon"><ShieldCheck size={16}/></span><div><strong>Xác thực hai bước</strong><small>Liên hệ quản trị viên để bật xác thực nhiều lớp</small></div><span className="security-status muted">Chưa bật</span></div>
      </Panel>
    </div> : <div className="settings-layout">
      <Panel title="Thông báo" subtitle="Chọn các loại thông báo muốn nhận">
        <form className="account-form" onSubmit={save}><div className="toggle-list"><Toggle icon={<Bell size={16}/>} title="Thông báo nghiệp vụ qua email" detail="Nhận thông báo khi có phiếu mới cần xử lý" checked={emailAlerts} onChange={setEmailAlerts}/><Toggle icon={<Check size={16}/>} title="Cập nhật phiếu chuyển kho" detail="Thông báo khi phiếu chuyển được giao hoặc xác nhận nhận" checked={transferAlerts} onChange={setTransferAlerts}/></div>
        <div className="form-actions"><button className="button primary" type="submit">{saved ? "Đã lưu" : "Lưu cài đặt"}</button></div></form>
        <div className="module-note"><span>i</span>Tùy chọn thông báo chỉ áp dụng cho tài khoản của bạn.</div>
      </Panel>
    </div>}
  </>;
}

function Toggle({ icon, title, detail, checked, onChange }: { icon: React.ReactNode; title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><span className="toggle-icon">{icon}</span><div className="toggle-copy"><strong>{title}</strong><small>{detail}</small></div><button type="button" className={`switch ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}><i/></button></div>;
}

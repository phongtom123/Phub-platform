"use client";

import { useState } from "react";
import { Bell, Building2, Check, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { Panel } from "@/src/components/warehouse/ui";

export default function AccountSettings({ section }: { section: "account" | "settings" }) {
  const [saved, setSaved] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [transferAlerts, setTransferAlerts] = useState(true);
  const isAccount = section === "account";

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return <>
    <div className="page-heading"><div><h1>{isAccount ? "Tài khoản của tôi" : "Cài đặt"}</h1></div></div>
    {isAccount ? <div className="account-layout">
      <Panel title="Thông tin cá nhân" subtitle="Thông tin liên hệ của tài khoản nhân viên">
        <form className="account-form" onSubmit={save}>
          <div className="profile-banner"><span className="profile-avatar">TP</span><div><strong>Trần Đức Phong</strong><small>Nhân viên kho · NV002</small></div><span className="active-pill"><i/> Đang hoạt động</span></div>
          <div className="form-grid"><label><span>Họ và tên</span><input defaultValue="Trần Đức Phong"/></label><label><span>Mã nhân viên</span><input value="NV002" readOnly/></label><label><span>Email công việc</span><input type="email" defaultValue="phong@phub.vn"/></label><label><span>Số điện thoại</span><input defaultValue="0918 220 114"/></label></div>
          <div className="form-actions"><button className="button primary" type="submit"><Save size={14}/>{saved ? "Đã lưu" : "Lưu thay đổi"}</button></div>
        </form>
      </Panel>
      <Panel title="Quyền và phân công" subtitle="Thông tin vai trò hiện tại">
        <div className="access-list"><div><ShieldCheck size={17}/><span><small>VAI TRÒ</small><strong>THU_KHO · Nhân viên kho</strong></span></div><div><Building2 size={17}/><span><small>PHẠM VI KHO</small><strong>Kho trung tâm</strong></span></div><div><UserRound size={17}/><span><small>CHI NHÁNH</small><strong>Trung tâm phân phối PHUB</strong></span></div></div>
        <div className="module-note"><span>i</span>Quyền truy cập do quản trị viên cấp. Liên hệ quản trị viên nếu cần thay đổi vai trò hoặc kho được phân công.</div>
      </Panel>
      <Panel title="Bảo mật tài khoản" subtitle="Cài đặt bảo vệ tài khoản">
        <div className="security-row"><span className="security-icon"><LockKeyhole size={16}/></span><div><strong>Mật khẩu</strong><small>Được quản lý bởi hệ thống đăng nhập</small></div><span className="security-status">Đang bảo vệ</span></div>
        <div className="security-row"><span className="security-icon"><ShieldCheck size={16}/></span><div><strong>Xác thực hai bước</strong><small>Liên hệ quản trị viên để bật xác thực nhiều lớp</small></div><span className="security-status muted">Chưa bật</span></div>
      </Panel>
    </div> : <div className="settings-layout">
      <Panel title="Thiết lập kho" subtitle="Mặc định sử dụng khi tạo phiếu mới">
        <form className="account-form" onSubmit={save}>
          <label className="setting-field"><span>Kho làm việc mặc định</span><select defaultValue="central"><option value="central">Kho trung tâm</option><option value="q1">Kho Quận 1</option><option value="td">Kho Thủ Đức</option></select></label>
          <div className="form-actions"><button className="button primary" type="submit"><Save size={14}/>{saved ? "Đã lưu" : "Lưu cài đặt"}</button></div>
        </form>
      </Panel>
      <Panel title="Thông báo" subtitle="Chọn các loại thông báo muốn nhận">
        <div className="toggle-list"><Toggle icon={<Bell size={16}/>} title="Thông báo nghiệp vụ qua email" detail="Nhận thông báo khi có phiếu mới cần xử lý" checked={emailAlerts} onChange={setEmailAlerts}/><Toggle icon={<Check size={16}/>} title="Cập nhật phiếu chuyển kho" detail="Thông báo khi phiếu chuyển được giao hoặc xác nhận nhận" checked={transferAlerts} onChange={setTransferAlerts}/></div>
        <div className="module-note"><span>i</span>Tùy chọn thông báo chỉ áp dụng cho tài khoản của bạn.</div>
      </Panel>
    </div>}
  </>;
}

function Toggle({ icon, title, detail, checked, onChange }: { icon: React.ReactNode; title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><span className="toggle-icon">{icon}</span><div className="toggle-copy"><strong>{title}</strong><small>{detail}</small></div><button type="button" className={`switch ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}><i/></button></div>;
}

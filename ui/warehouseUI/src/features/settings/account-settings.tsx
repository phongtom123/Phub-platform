"use client";
import { useEffect, useState } from "react";
import { Panel } from "@warehouse/src/components/warehouse/ui";

type Session = { name: string; username: string; employee_id: string | null; role: string; warehouse_id: number | null };
export default function AccountSettings({ section }: { section: "account" | "settings" }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (section !== "account") return;
    const controller = new AbortController();
    fetch("/api/backend/auth/me", { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Không tải được tài khoản."); return body; })
      .then(body => { if (!controller.signal.aborted) setSession(body); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [section]);
  if (section === "settings") return <Panel title="Cài đặt" subtitle="Chưa có API cài đặt kho"><p>Chưa thể tải hoặc lưu cài đặt. Kho làm việc lấy từ phân quyền thực tế của tài khoản, không chọn kho mẫu.</p></Panel>;
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
    <p className="account-note">Quyền và kho do quản trị viên cấp. Chức năng sửa hồ sơ/mật khẩu cho thủ kho chưa có API riêng.</p>
  </Panel>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@internal/lib/admin-fetch";
import type { CustomerDetail } from "@internal/lib/customer-profile";

export function CustomerArchiveButton({ customerId, archived, disabled, onSaved, onSavingChange }: {
  customerId: string; archived: boolean; disabled: boolean;
  onSaved: (data: CustomerDetail) => void; onSavingChange: (saving: boolean) => void;
}) {
  const controller = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => {
    if (controller.current) { controller.current.abort(); controller.current = null; onSavingChange(false); }
  }, [onSavingChange]);

  async function change() {
    if (disabled || controller.current) return;
    if (!window.confirm(archived
      ? "Khôi phục hồ sơ khách hàng? Tài khoản vẫn bị ẩn; Admin có thể bật lại sau khi khôi phục."
      : "Xóa khách hàng? Tài khoản sẽ bị ẩn và phiên đăng nhập cũ bị vô hiệu. Đơn hàng, hóa đơn và phản hồi vẫn được giữ.")) return;
    const request = new AbortController(); controller.current = request;
    setSaving(true); setError(""); onSavingChange(true);
    try {
      const response = await adminFetch(`/api/backend/crm/customers/${encodeURIComponent(customerId)}/archive`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: !archived }), signal: request.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không thể xóa/khôi phục khách hàng.");
      if (request.signal.aborted) return;
      if (body?.profile?.ma_kh !== customerId || Boolean(body.profile.luu_tru_luc) !== !archived ||
          (!archived && body.account && body.account.trang_thai !== 0)) throw new Error("API chưa xác nhận đúng kết quả xóa/khôi phục.");
      onSaved(body as CustomerDetail);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể lưu thay đổi.");
    } finally {
      if (controller.current === request) { controller.current = null; setSaving(false); onSavingChange(false); }
    }
  }
  return <div>
    <button type="button" disabled={disabled || saving} aria-label={`${archived ? "Khôi phục" : "Xóa"} khách hàng ${customerId}`}
      onClick={() => void change()}>{saving ? "Đang lưu…" : archived ? "Khôi phục" : "Xóa"}</button>
    {error && <small className="live-error" role="alert">{error}</small>}
  </div>;
}

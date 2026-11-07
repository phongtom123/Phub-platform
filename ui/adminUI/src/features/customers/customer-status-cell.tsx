"use client";

import { useEffect, useRef, useState } from "react";
import { accountApi, jsonRequest } from "../accounts/api";
import { statusLabels, type Account, type AccountStatus } from "../accounts/types";
import { useAdminAuth } from "@internal/components/admin/auth-provider";

export type CustomerLinkedAccount = { ma_tk: string; trang_thai: AccountStatus };

export function CustomerStatusCell({ customerId, customerName, account, disabled, onSaved, onSavingChange }: {
  customerId: string; customerName: string; account: CustomerLinkedAccount | null | undefined; disabled: boolean;
  onSaved: (customerId: string, account: CustomerLinkedAccount) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const { portal } = useAdminAuth();
  const controller = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => {
    if (controller.current) { controller.current.abort(); controller.current = null; onSavingChange(false); }
  }, [onSavingChange]);

  async function change(value: AccountStatus) {
    if (!account || disabled || controller.current || ![0, 1, 2].includes(value) || account.trang_thai === value) return;
    if (value !== 1 && !window.confirm(`Chuyển tài khoản của ${customerName} sang “${statusLabels[value]}”?`)) return;
    const request = new AbortController(); controller.current = request;
    setSaving(true); onSavingChange(true); setError(""); setNotice("");
    try {
      const saved = await accountApi<Account>(`accounts/${encodeURIComponent(account.ma_tk)}/status`, {
        ...jsonRequest("POST", { trang_thai: value }), signal: request.signal,
      });
      if (request.signal.aborted) return;
      if (saved.ma_tk !== account.ma_tk || saved.ma_kh !== customerId || saved.role !== "KHACH_HANG" || saved.trang_thai !== value) {
        throw new Error("API chưa xác nhận đúng trạng thái của khách hàng này.");
      }
      onSaved(customerId, { ma_tk: saved.ma_tk, trang_thai: saved.trang_thai });
      setNotice(`Đã lưu: ${statusLabels[value]}.`);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể lưu trạng thái.");
    } finally {
      if (controller.current === request) { controller.current = null; setSaving(false); onSavingChange(false); }
    }
  }

  if (account === undefined) return <span className="live-error">Chưa tải được trạng thái tài khoản. Hãy cập nhật backend và làm mới.</span>;
  if (!account) return <span>Chưa có tài khoản</span>;
  if (portal === "staff") return <span>{statusLabels[account.trang_thai]}</span>;
  return <div>
    <select className={`inline-data-status status-${account.trang_thai}`} aria-label={`Trạng thái tài khoản ${customerId}`}
      value={account.trang_thai} disabled={disabled || saving} aria-invalid={Boolean(error)}
      onChange={event => {
        const value = Number(event.currentTarget.value) as AccountStatus;
        event.currentTarget.value = String(account.trang_thai);
        void change(value);
      }}>
      {([1, 2, 0] as AccountStatus[]).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
    </select>
    {saving && <small role="status">Đang lưu…</small>}
    {error && <small className="live-error" role="alert">{error}</small>}
    {notice && <small role="status">{notice}</small>}
  </div>;
}

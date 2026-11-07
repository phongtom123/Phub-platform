"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "../../lib/admin-fetch";
import styles from "./counter-buyer-fields.module.css";

export type CounterBuyerDraft = { mode: "account" | "guest"; email: string; name: string; phone: string; customerId: string };
export const emptyCounterBuyer = (): CounterBuyerDraft => ({ mode: "account", email: "", name: "", phone: "", customerId: "" });
export const normalizedBuyerEmail = (value: string) => value.trim().toLowerCase();
export const validBuyerEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedBuyerEmail(value));
export const counterBuyerReady = (buyer: CounterBuyerDraft) => validBuyerEmail(buyer.email) && Boolean(buyer.name.trim()) && (buyer.mode === "guest" || Boolean(buyer.customerId));
type Customer = { ma_kh: string; ten_kh: string; sdt: string | null; email: string; ten_tai_khoan: string };

/** Used by both counter entrypoints. Changing email always clears the selected owner. */
export function CounterBuyerFields({ value, onChange, disabled = false }: {
  value: CounterBuyerDraft; onChange: (value: CounterBuyerDraft) => void; disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);
  const [username, setUsername] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function change(next: CounterBuyerDraft) {
    request.current?.abort(); request.current = null; setLooking(false); setError(""); setUsername(""); onChange(next);
  }
  async function lookup() {
    if (disabled || looking) return;
    if (!validBuyerEmail(value.email)) { setError("Nhập email khách hàng hợp lệ để tra cứu."); return; }
    const email = normalizedBuyerEmail(value.email);
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setLooking(true); setError(""); setUsername("");
    onChange({ ...value, email, customerId: "", name: "", phone: "" });
    try {
      const response = await adminFetch(`/api/backend/staff/counter/customers?email=${encodeURIComponent(email)}`, { signal: controller.signal, cache: "reload" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tra cứu được tài khoản khách hàng.");
      if (!body || !Array.isArray(body.data) || body.data.length > 1) throw new Error("API chưa xác nhận một tài khoản khách duy nhất theo email.");
      if (controller.signal.aborted || request.current !== controller) return;
      const customer = body.data[0] as Customer | undefined;
      if (!customer) { setError("Không có tài khoản khách đang hoạt động với email này. Có thể chọn Khách vãng lai để tiếp tục."); return; }
      if (!customer.ma_kh || typeof customer.ten_kh !== "string" || !customer.ten_kh.trim() ||
          typeof customer.email !== "string" || normalizedBuyerEmail(customer.email) !== email) {
        throw new Error("API trả tài khoản không khớp email đang tra cứu.");
      }
      onChange({ ...value, email, customerId: customer.ma_kh, name: customer.ten_kh, phone: customer.sdt ?? "" });
      setUsername(customer.ten_tai_khoan);
    } catch (reason) {
      if (!controller.signal.aborted && request.current === controller) setError(reason instanceof Error ? reason.message : "Không tra cứu được khách hàng.");
    } finally {
      if (request.current === controller) { request.current = null; setLooking(false); }
    }
  }

  return <fieldset className={styles.buyer} disabled={disabled}>
    <legend>Thông tin người mua</legend>
    <div className={styles.modes} role="group" aria-label="Loại khách hàng">
      <label><input type="radio" name="counter-buyer-mode" checked={value.mode === "account"} onChange={() => change({ ...emptyCounterBuyer(), email: value.email, mode: "account" })}/> Khách có tài khoản</label>
      <label><input type="radio" name="counter-buyer-mode" checked={value.mode === "guest"} onChange={() => change({ ...emptyCounterBuyer(), email: value.email, mode: "guest" })}/> Khách vãng lai</label>
    </div>
    <div className={styles.fields}>
      <label className={styles.email}>Email khách hàng *
        <span className={styles.lookup}><input aria-label="Email khách hàng" type="email" required maxLength={254} autoComplete="email" placeholder="khachhang@example.com"
          value={value.email} onChange={event => change({ ...value, email: event.target.value, customerId: "", ...(value.mode === "account" ? { name: "", phone: "" } : {}) })}
          onKeyDown={event => { if (event.key === "Enter" && value.mode === "account") { event.preventDefault(); void lookup(); } }}/>
          {value.mode === "account" && <button type="button" disabled={looking} onClick={() => void lookup()}>{looking ? "Đang tìm…" : "Tìm khách theo email"}</button>}
        </span>
      </label>
      <label>Tên người mua *<input aria-label="Tên người mua" required maxLength={200} autoComplete="name" value={value.name} readOnly={value.mode === "account"}
        placeholder={value.mode === "account" ? "Tra cứu email để lấy tên khách" : "Nhập tên người mua"}
        onChange={event => onChange({ ...value, name: event.target.value })}/></label>
      <label>Số điện thoại (không bắt buộc)<input aria-label="Số điện thoại người mua" type="tel" maxLength={30} autoComplete="tel" value={value.phone}
        onChange={event => onChange({ ...value, phone: event.target.value })}/></label>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {value.mode === "account" && value.customerId && <p className={styles.notice}>Đã chọn <strong>{value.name}</strong>{username && <> · {username}</>}. Đơn sẽ thuộc tài khoản khách này.</p>}
    {value.mode === "guest" && <p className={styles.notice}>Lưu tên và email trên đơn. Khách không cần tài khoản; đơn chỉ được liên kết tài khoản sau khi xác minh.</p>}
  </fieldset>;
}

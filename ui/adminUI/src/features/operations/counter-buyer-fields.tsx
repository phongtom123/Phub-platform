"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adminFetch } from "../../lib/admin-fetch";
import styles from "./counter-buyer-fields.module.css";

export type CounterBuyerDraft = { mode: "account" | "guest"; email: string; name: string; phone: string; customerId: string };
export const emptyCounterBuyer = (): CounterBuyerDraft => ({ mode: "account", email: "", name: "", phone: "", customerId: "" });
export const normalizedBuyerEmail = (value: string) => value.trim().toLowerCase();
export const validBuyerEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedBuyerEmail(value));
export const counterBuyerReady = (buyer: CounterBuyerDraft) => validBuyerEmail(buyer.email) && Boolean(buyer.name.trim()) && (buyer.mode === "guest" || Boolean(buyer.customerId));
type Customer = { ma_kh: string; ten_kh: string; sdt: string | null; email: string; ten_tai_khoan: string };

const customerLabel = (customer: Customer) => customer.ten_kh || customer.ten_tai_khoan || customer.email;

/** Shared by admin and warehouse counter entrypoints. Search results float over the form. */
export function CounterBuyerFields({ value, onChange, disabled = false }: {
  value: CounterBuyerDraft; onChange: (value: CounterBuyerDraft) => void; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [username, setUsername] = useState("");
  const request = useRef<AbortController | null>(null);
  const listId = useId();

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const term = query.trim();
    if (disabled || value.mode !== "account" || value.customerId || term.length < 2) {
      request.current?.abort(); request.current = null; setLooking(false); setResults([]);
      if (term.length < 2) setOpen(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      const controller = new AbortController(); request.current?.abort(); request.current = controller;
      setLooking(true); setError(""); setOpen(true);
      try {
        const response = await adminFetch(`/api/backend/staff/counter/customers?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tra cứu được tài khoản khách hàng.");
        if (!body || !Array.isArray(body.data)) throw new Error("Dữ liệu tài khoản khách hàng không hợp lệ.");
        if (controller.signal.aborted || request.current !== controller) return;
        const rows = body.data.filter((row: Customer) => row?.ma_kh && row?.email && row?.ten_kh);
        setResults(rows); setActive(rows.length ? 0 : -1);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (!controller.signal.aborted && request.current === controller) {
          setResults([]); setActive(-1); setError(reason instanceof Error ? reason.message : "Không tra cứu được khách hàng.");
        }
      } finally {
        if (request.current === controller) { request.current = null; setLooking(false); }
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [disabled, query, value.customerId, value.mode]);

  function reset(next: CounterBuyerDraft) {
    request.current?.abort(); request.current = null; setLooking(false); setResults([]); setOpen(false);
    setActive(-1); setError(""); setUsername(""); setQuery(""); onChange(next);
  }
  function search(next: string) {
    setQuery(next); setOpen(next.trim().length >= 2); setError(""); setUsername("");
    if (value.customerId) onChange({ ...value, customerId: "", email: "", name: "", phone: "" });
  }
  function choose(customer: Customer) {
    request.current?.abort(); request.current = null;
    setQuery(customerLabel(customer)); setResults([]); setOpen(false); setActive(-1); setLooking(false); setError("");
    setUsername(customer.ten_tai_khoan);
    onChange({ ...value, customerId: customer.ma_kh, name: customer.ten_kh, email: normalizedBuyerEmail(customer.email), phone: customer.sdt ?? "" });
  }
  function searchKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (!open || !results.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => (index + 1) % results.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index - 1 + results.length) % results.length); }
    else if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(results[active]); }
  }

  return <fieldset className={styles.buyer} disabled={disabled}>
    <legend>Thông tin người mua</legend>
    <div className={styles.modes} role="group" aria-label="Loại khách hàng">
      <label><input type="radio" name="counter-buyer-mode" checked={value.mode === "account"} onChange={() => reset({ ...emptyCounterBuyer(), mode: "account" })}/> Khách có tài khoản</label>
      <label><input type="radio" name="counter-buyer-mode" checked={value.mode === "guest"} onChange={() => reset({ ...emptyCounterBuyer(), mode: "guest" })}/> Khách vãng lai</label>
    </div>
    {value.mode === "account" && <div className={styles.searchBlock}>
      <label htmlFor={`${listId}-search`}>Tìm tài khoản khách hàng *</label>
      <div className={styles.searchControl}>
        <input id={`${listId}-search`} role="combobox" aria-label="Tìm tài khoản khách hàng" aria-autocomplete="list"
          aria-expanded={open} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off" placeholder="Nhập tên, email hoặc số điện thoại" value={query}
          onFocus={() => { if (query.trim().length >= 2 && !value.customerId) setOpen(true); }}
          onChange={event => search(event.target.value)} onKeyDown={searchKey}/>
        {open && <div id={listId} className={styles.results} role="listbox" aria-label="Kết quả tìm khách hàng">
          {looking && <div className={styles.resultState}>Đang tìm khách hàng…</div>}
          {!looking && !error && !results.length && <div className={styles.resultState}>Không tìm thấy tài khoản đang hoạt động.</div>}
          {!looking && results.map((customer, index) => <button id={`${listId}-${index}`} key={customer.ma_kh} type="button"
            role="option" aria-selected={active === index} className={active === index ? styles.activeResult : ""}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(customer)}>
            <strong>{customer.ten_kh}</strong><span>{customer.email}{customer.sdt ? ` · ${customer.sdt}` : ""}</span>
            <small>{customer.ten_tai_khoan} · {customer.ma_kh}</small>
          </button>)}
        </div>}
      </div>
    </div>}
    <div className={styles.fields}>
      <label className={styles.email}>Email khách hàng *<input aria-label="Email khách hàng" type="email" required maxLength={254} autoComplete="email"
        placeholder="khachhang@example.com" value={value.email} readOnly={value.mode === "account"}
        onChange={event => onChange({ ...value, email: event.target.value })}/></label>
      <label>Tên người mua *<input aria-label="Tên người mua" required maxLength={200} autoComplete="name" value={value.name} readOnly={value.mode === "account"}
        placeholder={value.mode === "account" ? "Chọn tài khoản để tự điền" : "Nhập tên người mua"}
        onChange={event => onChange({ ...value, name: event.target.value })}/></label>
      <label>Số điện thoại (không bắt buộc)<input aria-label="Số điện thoại người mua" type="tel" maxLength={30} autoComplete="tel" value={value.phone}
        readOnly={value.mode === "account"} onChange={event => onChange({ ...value, phone: event.target.value })}/></label>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {value.mode === "account" && value.customerId && <p className={styles.notice}>Đã chọn <strong>{value.name}</strong>{username && <> · {username}</>}. Đơn sẽ thuộc tài khoản khách này.</p>}
    {value.mode === "guest" && <p className={styles.notice}>Lưu tên và email trên đơn. Khách không cần tài khoản; đơn chỉ được liên kết tài khoản sau khi xác minh.</p>}
  </fieldset>;
}

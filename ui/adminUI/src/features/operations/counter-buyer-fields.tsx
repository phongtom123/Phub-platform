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
type ModeSwitch = { email: string; mode: "guest" } | { email: string; mode: "account"; customer: Customer };

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
  const [modeSwitch, setModeSwitch] = useState<ModeSwitch | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const emailInput = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const lookupInput = value.mode === "guest" ? value.email : query;
  const term = lookupInput.trim();
  const exactEmail = validBuyerEmail(term);

  useEffect(() => {
    setModeSwitch(null);
    if (disabled || value.customerId || term.length < 2 || (value.mode === "guest" && !exactEmail)) {
      request.current?.abort(); request.current = null; setLooking(false); setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setLooking(true); setError(""); setResults([]); setActive(-1);
    setOpen(value.mode === "account");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams(exactEmail ? { email: normalizedBuyerEmail(term) } : { q: term });
        const response = await adminFetch(`/api/backend/staff/counter/customers?${params}`, { signal: controller.signal, cache: "reload" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không tra cứu được tài khoản khách hàng.");
        if (!body || !Array.isArray(body.data)) throw new Error("Dữ liệu tài khoản khách hàng không hợp lệ.");
        if (controller.signal.aborted || request.current !== controller) return;
        const rows: Customer[] = body.data;
        if (rows.some(row => !row || typeof row.ma_kh !== "string" || !row.ma_kh || typeof row.email !== "string" || !validBuyerEmail(row.email)
          || typeof row.ten_kh !== "string" || !row.ten_kh || typeof row.ten_tai_khoan !== "string"
          || (row.sdt !== null && typeof row.sdt !== "string"))
          || (exactEmail && (rows.length > 1 || rows.some(row => normalizedBuyerEmail(row.email) !== normalizedBuyerEmail(term))))) {
          throw new Error("Dữ liệu tài khoản khách hàng không hợp lệ.");
        }
        if (exactEmail && value.mode === "account" && !rows.length) {
          setModeSwitch({ mode: "guest", email: normalizedBuyerEmail(term) }); setOpen(false);
        } else if (exactEmail && value.mode === "guest" && rows.length) {
          setModeSwitch({ mode: "account", email: normalizedBuyerEmail(term), customer: rows[0] });
        }
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
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [disabled, lookupInput, term, exactEmail, value.customerId, value.mode, retry]);

  useEffect(() => {
    emailInput.current?.setCustomValidity(looking ? "Vui lòng chờ tra cứu khách hàng."
      : error ? "Tra cứu khách hàng chưa thành công. Vui lòng thử lại."
      : modeSwitch ? "Vui lòng xác nhận chuyển loại khách hàng hoặc chọn giữ nguyên." : "");
  }, [looking, error, modeSwitch]);

  function reset(next: CounterBuyerDraft) {
    request.current?.abort(); request.current = null; setLooking(false); setResults([]); setOpen(false);
    setActive(-1); setError(""); setUsername(""); setQuery(""); setModeSwitch(null); onChange(next);
  }
  function search(next: string) {
    request.current?.abort(); request.current = null;
    setQuery(next); setOpen(next.trim().length >= 2); setError(""); setUsername(""); setModeSwitch(null); setResults([]); setActive(-1);
    setLooking(next.trim().length >= 2);
    if (value.customerId || value.email) onChange({ ...value, customerId: "", email: "", name: "", phone: "" });
  }
  function editEmail(next: string) {
    request.current?.abort(); request.current = null;
    setModeSwitch(null); setError(""); setUsername(""); setResults([]); setActive(-1); setOpen(false);
    setLooking(validBuyerEmail(next));
    if (value.mode === "account") setQuery(next);
    onChange({ ...value, email: next, customerId: "", ...(value.mode === "account" ? { name: "", phone: "" } : {}) });
  }
  function choose(customer: Customer) {
    request.current?.abort(); request.current = null;
    setQuery(customerLabel(customer)); setResults([]); setOpen(false); setActive(-1); setLooking(false); setError(""); setModeSwitch(null);
    setUsername(customer.ten_tai_khoan);
    onChange({ mode: "account", customerId: customer.ma_kh, name: customer.ten_kh, email: normalizedBuyerEmail(customer.email), phone: customer.sdt ?? "" });
  }
  function confirmModeSwitch() {
    if (!modeSwitch || modeSwitch.email !== normalizedBuyerEmail(term)) return;
    if (modeSwitch.mode === "account") choose(modeSwitch.customer);
    else reset({ ...value, mode: "guest", customerId: "", email: modeSwitch.email });
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
      <label className={styles.email}>Email khách hàng *<input ref={emailInput} aria-label="Email khách hàng" type="email" required maxLength={254} autoComplete="email"
        placeholder="khachhang@example.com" value={value.email} onChange={event => editEmail(event.target.value)}/></label>
      <label>Tên người mua *<input aria-label="Tên người mua" required maxLength={200} autoComplete="name" value={value.name} readOnly={value.mode === "account"}
        placeholder={value.mode === "account" ? "Chọn tài khoản để tự điền" : "Nhập tên người mua"}
        onChange={event => onChange({ ...value, name: event.target.value })}/></label>
      <label>Số điện thoại (không bắt buộc)<input aria-label="Số điện thoại người mua" type="tel" maxLength={30} autoComplete="tel" value={value.phone}
        readOnly={value.mode === "account"} onChange={event => onChange({ ...value, phone: event.target.value })}/></label>
    </div>
    {looking && value.mode === "guest" && <p className={styles.notice} role="status">Đang kiểm tra tài khoản theo email…</p>}
    {modeSwitch && <div className={styles.switchNotice} role="alertdialog" aria-labelledby={`${listId}-switch-title`} aria-describedby={`${listId}-switch-description`}>
      <h3 id={`${listId}-switch-title`}>{modeSwitch.mode === "guest" ? "Không tìm thấy tài khoản khách hàng" : "Email đã có tài khoản khách hàng"}</h3>
      <p id={`${listId}-switch-description`}>{modeSwitch.mode === "guest"
        ? <>Không tìm thấy tài khoản đang hoạt động với email <strong>{modeSwitch.email}</strong>. Xác nhận chuyển sang khách vãng lai và giữ email này?</>
        : <>Email <strong>{modeSwitch.email}</strong> thuộc tài khoản của <strong>{customerLabel(modeSwitch.customer)}</strong>. Xác nhận chuyển sang khách có tài khoản và điền thông tin khách này?</>}</p>
      <div className={styles.switchActions}>
        <button type="button" className={styles.switchConfirm} onClick={confirmModeSwitch}>Xác nhận chuyển</button>
        <button type="button" onClick={() => setModeSwitch(null)}>Giữ nguyên</button>
      </div>
    </div>}
    {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => setRetry(current => current + 1)}>Thử lại tra cứu</button></div>}
    {value.mode === "account" && value.customerId && <p className={styles.notice}>Đã chọn <strong>{value.name}</strong>{username && <> · {username}</>}. Đơn sẽ thuộc tài khoản khách này.</p>}
    {value.mode === "guest" && <p className={styles.notice}>Lưu tên và email trên đơn. Khách không cần tài khoản; đơn chỉ được liên kết tài khoản sau khi xác minh.</p>}
  </fieldset>;
}

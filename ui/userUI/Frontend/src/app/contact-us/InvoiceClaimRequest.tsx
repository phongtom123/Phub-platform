"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CustomerTicket } from "./ContactForm";
import styles from "./contact.module.css";

export default function InvoiceClaimRequest({ onCreated, initiallyOpen = false }: { onCreated: (ticket: CustomerTicket) => void; initiallyOpen?: boolean }) {
  const [invoice, setInvoice] = useState(""), [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const pending = useRef<{ fingerprint: string; key: string } | null>(null), inFlight = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    const fingerprint = JSON.stringify({ invoice_id: invoice.trim(), evidence: evidence.trim() });
    if (invoice.trim().length === 0 || evidence.trim().length < 10) { setError("Nhập mã hóa đơn và thông tin mua hàng ít nhất 10 ký tự."); return; }
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/backend/customer/crm/invoice-claims", { method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key }, body: fingerprint });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Chưa gửi được yêu cầu. Hãy kiểm tra và thử lại.");
      pending.current = null; setInvoice(""); setEvidence(""); setNotice("Đã tiếp nhận yêu cầu. Nhân viên sẽ đối chiếu chứng từ trước khi liên kết; xem kết quả trong lịch sử hỗ trợ bên dưới."); onCreated(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Chưa xác nhận gửi thành công. Bạn có thể thử lại cùng nội dung."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <details className={styles.relatedDetails} open={initiallyOpen || undefined}>
    <summary>Đã mua tại cửa hàng trước khi có tài khoản? Yêu cầu liên kết hóa đơn</summary>
    <p>Cung cấp mã trên hóa đơn và ngày mua, số tiền hoặc thông tin liên hệ lúc mua. Nhân viên xác minh rồi gắn đơn vào tài khoản này. Đơn hoàn thành sẽ cho phép bạn đánh giá sản phẩm.</p>
    <form className={styles.form} onSubmit={submit}>
      <label>Mã hóa đơn tại cửa hàng *<input required maxLength={100} value={invoice} disabled={busy} onChange={e => setInvoice(e.target.value)} placeholder="Nhập đúng mã trên hóa đơn, ví dụ HD-…"/></label>
      <label>Thông tin để đối chiếu *<textarea required minLength={10} maxLength={2000} value={evidence} disabled={busy} onChange={e => setEvidence(e.target.value)} placeholder="Ngày mua, số tiền, sản phẩm, số điện thoại lúc mua… Không cung cấp mật khẩu hoặc OTP."/></label>
      <div className={styles.formFooter}><button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Yêu cầu liên kết hóa đơn"}</button></div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}{notice && <p className={styles.status} role="status">{notice}</p>}
    </form>
  </details>;
}

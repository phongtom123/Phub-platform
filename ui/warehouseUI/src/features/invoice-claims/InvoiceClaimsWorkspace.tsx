"use client";

import { useEffect, useState } from "react";
import InvoiceClaimReview from "./InvoiceClaimReview";
import { staffRequest, claimLabel, type ClaimTicket } from "../../../../shared/invoice-claims";
import styles from "../../../../shared/invoice-claims.module.css";

export default function InvoiceClaimsWorkspace() {
  const [page, setPage] = useState(1), [version, setVersion] = useState(0);
  const [items, setItems] = useState<{data: ClaimTicket[]; total: number} | null>(null);
  const [error, setError] = useState(""), [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    staffRequest<{data: ClaimTicket[]; total: number}>(`invoice-claims?page=${page}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setItems(value); setError(""); } })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Không tải được yêu cầu."); });
    return () => controller.abort();
  }, [page, version]);
  return <div className={styles.workspace}><div className={styles.heading}><div><h1>Liên kết hóa đơn</h1><p>Xác minh yêu cầu gắn đơn mua tại cửa hàng vào tài khoản khách hàng.</p></div>
    <button type="button" onClick={() => setVersion(v => v + 1)}>Làm mới danh sách</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.inbox}><aside className={styles.card} aria-label="Danh sách yêu cầu">
      {!items && !error && <p role="status">Đang tải…</p>}
      {items?.data.length === 0 && <p>Chưa có yêu cầu liên kết hóa đơn.</p>}
      {items?.data.map(t => <button type="button" key={t.ma_phan_hoi} className={styles.item} aria-pressed={selected === t.ma_phan_hoi} onClick={() => setSelected(t.ma_phan_hoi)}>
        <strong>{t.ma_hoa_don_yeu_cau}</strong><span>{t.ten_kh} · {t.ma_kh}</span><small>{claimLabel(t.ket_qua_lien_ket)} · PH-{t.ma_phan_hoi.slice(0, 8).toUpperCase()}</small></button>)}
      <div className={styles.actions}><button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page}</span>
        <button type="button" disabled={!items || page * 20 >= items.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    </aside>{selected ? <InvoiceClaimReview key={selected} ticketId={selected} onUpdated={() => setVersion(v => v + 1)}/> : <section className={styles.card}><p>Chọn yêu cầu để đối chiếu và xác minh.</p></section>}</div>
  </div>;
}

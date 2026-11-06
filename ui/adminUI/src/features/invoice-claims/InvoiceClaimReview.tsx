"use client";

import { useEffect, useRef, useState } from "react";
import { staffRequest, claimLabel, type ClaimDetail } from "../../../../shared/invoice-claims";
import styles from "../../../../shared/invoice-claims.module.css";

export default function InvoiceClaimReview({ ticketId, onUpdated }: { ticketId: string; onUpdated?: () => void }) {
  const [detail, setDetail] = useState<ClaimDetail | null>(null), [version, setVersion] = useState(0);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [note, setNote] = useState(""), [verified, setVerified] = useState(false), [busy, setBusy] = useState(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    staffRequest<ClaimDetail>(`invoice-claims/${ticketId}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setDetail(value); setError(""); setNote(""); setVerified(false); } })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Không tải được yêu cầu."); });
    return () => controller.abort();
  }, [ticketId, version]);

  async function decide(action: "approve" | "reject") {
    if (!detail || inFlight.current) return;
    if (note.trim().length < 10) { setError("Nhập ghi chú xác minh ít nhất 10 ký tự."); return; }
    if (action === "approve" && !verified) { setError("Hãy xác minh chứng từ với khách trước khi chấp nhận."); return; }
    const body = { action, expected_version: detail.ticket.phien_ban_lien_ket, verification_note: note.trim(),
      verified, invoice_version: detail.invoice_version ?? null };
    const fingerprint = JSON.stringify(body);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const value = await staffRequest<ClaimDetail>(`invoice-claims/${ticketId}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key }, body: fingerprint,
      });
      setDetail(value); pending.current = null;
      setNotice(action === "approve" ? "Đã liên kết đơn vào tài khoản khách." : "Đã ghi nhận từ chối yêu cầu.");
      onUpdated?.();
    } catch (err) { setError(err instanceof Error ? err.message : "Chưa xác nhận được kết quả. Thử lại cùng nội dung hoặc làm mới để kiểm tra."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className={styles.card} aria-label="Xác minh liên kết hóa đơn">
    <div className={styles.heading}><h3>Liên kết hóa đơn mua tại cửa hàng</h3>
      <button type="button" disabled={busy} onClick={() => { setDetail(null); setVersion(v => v + 1); }}>Làm mới đối chiếu</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {!detail && !error && <p role="status">Đang tải thông tin xác minh…</p>}
    {detail && <>
      <p><strong>{claimLabel(detail.ticket.ket_qua_lien_ket)}</strong> · Hóa đơn yêu cầu: {detail.ticket.ma_hoa_don_yeu_cau}</p>
      <div className={styles.columns}>
        <div><h4>Khách yêu cầu</h4><p>{detail.customer.ten_kh} · {detail.customer.ma_kh}</p>
          <p>Tài khoản: {detail.customer.tai_khoan ?? "Không hoạt động"}</p><p>SĐT hồ sơ: {detail.customer.sdt ?? "Chưa có"}</p>
          <p className={styles.preserve}>{detail.ticket.noi_dung}</p></div>
        <div><h4>Chứng từ đang lưu</h4>{detail.invoice ? <>
          <p>{detail.invoice.ma_hoadon}</p><p>Đơn: {detail.invoice.ma_donhang}</p>
          <p>Người mua: {detail.invoice.ten_nguoi_mua || "Chưa có"}</p>
          <p>SĐT trên đơn: {detail.invoice.sdt_nguoi_nhan || "Chưa có"}</p>
          <p>Ngày lập: {new Date(detail.invoice.thoi_gian_lap).toLocaleString("vi-VN")}</p>
          <p>Tổng: {Number(detail.invoice.tong_tien_sau_thue).toLocaleString("vi-VN")} ₫</p>
          <p>{detail.invoice.kenh_ban === "TAI_QUAY" ? "Tại quầy" : "Trực tuyến"} · {detail.invoice.trang_thai}</p>
        </> : <p>Chưa tìm thấy hóa đơn theo mã khách cung cấp.</p>}</div>
      </div>
      {detail.reason && <p className={styles.hint}>{detail.reason}</p>}
      {detail.ticket.ket_qua_lien_ket ? <p className={styles.preserve}>Xác minh bởi {detail.ticket.tai_khoan_xac_minh} · {detail.ticket.xac_minh_luc && new Date(detail.ticket.xac_minh_luc).toLocaleString("vi-VN")}<br/>{detail.ticket.ghi_chu_xac_minh}</p> :
        ["MOI", "DANG_XU_LY"].includes(detail.ticket.trang_thai) && <fieldset disabled={busy} className={styles.form}>
          <p>Đối chiếu hóa đơn gốc, ngày mua, số tiền và thông tin liên hệ với khách. Không chấp nhận chỉ vì trùng tên hoặc số điện thoại.</p>
          <label className={styles.check}><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)}/>Tôi đã xác minh chứng từ và đúng chủ sở hữu</label>
          <label>Ghi chú xác minh nội bộ (bắt buộc)<textarea minLength={10} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi cách xác minh và kết quả; không nhập mật khẩu/OTP…"/></label>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={!detail.can_link || !verified} onClick={() => void decide("approve")}>{busy ? "Đang xử lý…" : "Chấp nhận liên kết"}</button>
            <button type="button" onClick={() => void decide("reject")}>Từ chối yêu cầu</button></div>
        </fieldset>}
    </>}
  </section>;
}

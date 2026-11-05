"use client";

import { useState } from "react";
import { useAdminPolling } from "../../lib/use-admin-polling";
import { formatMoney } from "../operations/financial-summary";
import { readOrderPaymentContext, type OrderPaymentContext } from "../operations/order-payment-data";
import styles from "./order-financial-summary.module.css";
import type { AdminOrderDetailData } from "./order-detail-data";

export function OrderFinancialSummary({ orderId, version, financial, onRefresh }: {
  orderId: string; version: number; financial?: AdminOrderDetailData["financial"]; onRefresh?: () => void;
}) {
  const [retry, setRetry] = useState(0);
  const identity = JSON.stringify([orderId, version, retry]);
  const [snapshot, setSnapshot] = useState<{ identity: string; data: OrderPaymentContext } | null>(null);
  const error = useAdminPolling(identity, !financial, async (signal, canApply) => {
    const data = await readOrderPaymentContext(orderId, signal);
    if (canApply()) setSnapshot({ identity, data });
  });
  const data = financial ?? (snapshot?.identity === identity ? snapshot.data : null);
  const invoiceIssued = data ? ("invoice_status" in data ? data.invoice_status === "DA_LAP" : data.invoiceId !== null) : false;
  const values = data ? [
    ["Tổng hóa đơn", data.total === null ? "Chưa có hóa đơn" : formatMoney(data.total)],
    ["Đã thu", formatMoney(data.collected)],
    ["Đã hoàn", formatMoney(data.refunded)],
    ["Còn phải thu", data.remaining === null ? "Chưa xác định" : formatMoney(data.remaining)],
  ] : [];

  return <section className={styles.summary} aria-label="Tổng hợp hóa đơn và thanh toán" aria-busy={!data && !error}>
    <div className={styles.heading}>
      <div className={styles.title}><h2>Hóa đơn và thanh toán</h2>{data && <span className={invoiceIssued ? styles.issued : styles.missing}>
        Hóa đơn: {invoiceIssued ? "Đã lập" : "Chưa lập"}
      </span>}</div>
      <button type="button" onClick={() => financial && onRefresh ? onRefresh() : setRetry(value => value + 1)}>Cập nhật thanh toán</button>
    </div>
    {data && <>
      <dl className={styles.values}>{values.map(([label, value]) => <div key={label}>
        <dt>{label}</dt><dd>{value}</dd>
      </div>)}</dl>
      <p className={styles.note}>Còn phải thu = tổng hóa đơn sau thuế − (đã thu − đã hoàn). Chỉ tính giao dịch thành công.</p>
    </>}
    {!data && !error && <p role="status">Đang tải hóa đơn và thanh toán…</p>}
    {error && <p role="alert" className={styles.error}>{data ? "Chưa cập nhật được số liệu mới. " : ""}{error}</p>}
  </section>;
}

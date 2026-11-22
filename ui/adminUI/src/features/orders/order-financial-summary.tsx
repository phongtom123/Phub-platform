"use client";

import { useState } from "react";
import { useAdminPolling } from "../../lib/use-admin-polling";
import { formatMoney } from "../operations/financial-summary";
import { moneyCents, readOrderPaymentContext, type OrderPaymentContext } from "../operations/order-payment-data";
import styles from "./order-financial-summary.module.css";
import type { AdminOrderDetailData } from "./order-detail-data";

const remainingHint = "Còn phải thu = tổng hóa đơn sau thuế − (đã thu − đã hoàn). Chỉ tính giao dịch thành công.";

export function OrderFinancialSummary({ orderId, orderStatus, version, financial, onRefresh }: {
  orderId: string; orderStatus: string; version: number; financial?: AdminOrderDetailData["financial"]; onRefresh?: () => void;
}) {
  const [retry, setRetry] = useState(0);
  const identity = JSON.stringify([orderId, version, retry]);
  const [snapshot, setSnapshot] = useState<{ identity: string; data: OrderPaymentContext } | null>(null);
  const error = useAdminPolling(identity, !financial, async (signal, canApply) => {
    const data = await readOrderPaymentContext(orderId, signal);
    if (canApply()) setSnapshot({ identity, data });
  });
  const data = financial ?? (snapshot?.identity === identity ? snapshot.data : null);
  const cancelled = orderStatus === "HUY";
  const invoiceIssued = data ? ("invoice_status" in data ? data.invoice_status === "DA_LAP" : data.invoiceId !== null) : false;
  const values = data ? [
    ["Tổng hóa đơn", data.total === null ? "Chưa có hóa đơn" : formatMoney(data.total)],
    ["Tổng đã thu", formatMoney(data.collected), "Tổng các khoản thu thành công, chưa trừ tiền hoàn."],
    ["Đã hoàn", formatMoney(data.refunded), "Tổng các khoản hoàn tiền thành công."],
    cancelled ? ["Thực giữ", formatMoney(data.paid), "Thực giữ = tổng đã thu − đã hoàn. Đơn đã hủy không thu thêm tiền."]
      : ["Còn phải thu", data.remaining === null ? (invoiceIssued ? "Chưa xác định" : "Chờ lập hóa đơn") : formatMoney(data.remaining),
        invoiceIssued ? remainingHint : "Khoản phải thu được xác định sau khi lập hóa đơn."],
  ] : [];

  return <section className={styles.summary} aria-label="Tổng hợp hóa đơn và thanh toán" aria-busy={!data && !error}>
    <div className={styles.heading}>
      <div className={styles.title}><h2>Thanh toán</h2>{data && <span className={invoiceIssued ? styles.issued : styles.missing}>
        Hóa đơn: {invoiceIssued ? "Đã lập" : "Chưa lập"}
      </span>}</div>
      <button type="button" onClick={() => financial && onRefresh ? onRefresh() : setRetry(value => value + 1)}>Cập nhật thanh toán</button>
    </div>
    {data && <>
      <dl className={styles.values}>{values.map(([label, value, hint]) => <div key={label} title={hint}>
        <dt>{label}</dt><dd>{value}</dd>
      </div>)}</dl>
      {cancelled && <p className={styles.cancelledNote}>Đơn đã hủy, không thu thêm tiền.
        {moneyCents(data.paid) > BigInt(0) ? ` Còn ${formatMoney(data.paid)} cần đối chiếu hoàn tiền.`
          : moneyCents(data.refunded) > BigInt(0) ? " Đã hoàn đủ số tiền từng thu." : " Không có khoản tiền đang giữ."}
      </p>}
    </>}
    {!data && !error && <p role="status">Đang tải hóa đơn và thanh toán…</p>}
    {error && <p role="alert" className={styles.error}>{data ? "Chưa cập nhật được số liệu mới. " : ""}{error}</p>}
  </section>;
}

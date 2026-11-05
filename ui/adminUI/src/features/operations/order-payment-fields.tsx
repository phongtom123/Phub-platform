"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, ReceiptText, RefreshCw } from "lucide-react";
import { formatMoney } from "./financial-summary";
import { moneyCents, paymentMethods, readOrderPaymentContext, type OrderPaymentContext, type PaymentMethod } from "./order-payment-data";
import styles from "./order-payment.module.css";

export type CollectionDraft = { amount: string; method: PaymentMethod; reference: string; ready: boolean };

export function OrderPaymentFields({ orderId, disabled, onChange, onInvoice }: {
  orderId: string; disabled: boolean; onChange: (draft: CollectionDraft) => void; onInvoice?: () => void;
}) {
  const [context, setContext] = useState<OrderPaymentContext | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [partial, setPartial] = useState(false), [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TIEN_MAT"), [reference, setReference] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setContext(null); setError(""); setPartial(false); setCustomAmount(""); setReference("");
    readOrderPaymentContext(orderId, controller.signal).then(data => {
      if (!controller.signal.aborted) { setContext(data); setMethod(data.suggestedMethod ?? "TIEN_MAT"); }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được thông tin thanh toán."); });
    return () => controller.abort();
  }, [orderId, version]);

  const amount = partial ? customAmount.replace(",", ".") : context?.remaining ?? "";
  const amountValid = useMemo(() => {
    if (!context?.remaining || context.total === null) return false;
    try { const value = moneyCents(amount); return value > BigInt(0) && value <= moneyCents(context.remaining); }
    catch { return false; }
  }, [amount, context]);
  const ready = !error && amountValid && (method === "TIEN_MAT" || Boolean(reference.trim()));
  useEffect(() => { onChange({ amount, method, reference: reference.trim(), ready }); }, [amount, method, reference, ready, onChange]);
  useEffect(() => () => { onChange({ amount: "", method: "TIEN_MAT", reference: "", ready: false }); }, [onChange]);

  if (error) return <div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={disabled} onClick={() => setVersion(value => value + 1)}><RefreshCw size={15} />Tải lại thông tin thanh toán</button></div>;
  if (!context) return <p className={styles.loading} role="status">Đang lấy hóa đơn và số tiền còn phải thu…</p>;
  if (context.total === null) return <div className={styles.notice} role="status"><ReceiptText size={22} /><div><strong>Đơn hàng chưa có hóa đơn</strong><p>Lập hóa đơn từ thông tin đơn hàng để xác định số tiền cần thu. Bạn không cần nhập lại sản phẩm hoặc đơn giá.</p>{onInvoice && <button type="button" disabled={disabled} onClick={onInvoice}>Lập hóa đơn từ đơn hàng</button>}</div></div>;
  if (context.remaining === "0.00") return <div className={styles.notice} role="status"><CheckCircle2 size={23} /><div><strong>Đơn hàng đã thu đủ tiền</strong><p>Đã thu sau hoàn tiền: {formatMoney(context.paid)} · Hóa đơn: {formatMoney(context.total)}. Không cần ghi nhận thêm khoản thu.</p></div></div>;

  return <div className={styles.payment}>
    <div className={styles.summary} aria-label="Tình hình thanh toán của đơn"><div><span>Tổng hóa đơn</span><strong>{formatMoney(context.total)}</strong></div><div><span>Đã thu (trừ hoàn)</span><strong>{formatMoney(context.paid)}</strong></div><div className={styles.remaining}><span>Còn phải thu</span><strong>{formatMoney(context.remaining!)}</strong></div></div>
    <div className={styles.invoice}><ReceiptText size={15} /><span>Hóa đơn {context.invoiceId}</span><button type="button" disabled={disabled} onClick={() => setVersion(value => value + 1)}><RefreshCw size={13} />Cập nhật số tiền</button></div>
    {context.refunded !== "0.00" && <p className={styles.hint}>Đã hoàn {formatMoney(context.refunded)}; số tiền này đã được trừ khỏi khoản đã thu ở trên.</p>}
    <label className={styles.partial}><input type="checkbox" checked={partial} disabled={disabled} onChange={event => { setPartial(event.target.checked); setCustomAmount(""); }} /><span>Khách chỉ thanh toán một phần</span></label>
    {partial && <label className={styles.custom}>Số tiền thu lần này<input aria-label="Số tiền thu lần này" inputMode="decimal" value={customAmount} disabled={disabled} placeholder="Nhập số tiền thực nhận" onChange={event => setCustomAmount(event.target.value)} /><small>Tối đa {formatMoney(context.remaining!)}.</small>{customAmount && !amountValid && <span className={styles.invalid}>Số tiền phải lớn hơn 0 và không vượt phần còn phải thu.</span>}</label>}
    <div className={styles.fields}>
      <label><span><CreditCard size={15} />Phương thức thanh toán</span><select aria-label="Phương thức thanh toán" value={method} disabled={disabled} onChange={event => { setMethod(event.target.value as PaymentMethod); setReference(""); }}>{Object.entries(paymentMethods).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select><small>{context.suggestedMethod ? "Gợi ý từ giao dịch đã lưu của đơn. Có thể đổi nếu thực tế khác." : "Chọn phương thức khách vừa thanh toán thực tế."}</small></label>
      {method !== "TIEN_MAT" && <label>Mã đối soát của khoản thu mới *<input required aria-label="Mã đối soát của khoản thu mới" maxLength={200} value={reference} disabled={disabled} onChange={event => setReference(event.target.value)} placeholder="Mã giao dịch được ngân hàng/cổng thanh toán xác nhận" /><small>Mỗi khoản thu dùng mã riêng, không dùng lại mã giao dịch cũ.</small></label>}
    </div>
    <p className={styles.hint}>Chỉ xác nhận sau khi đã nhận tiền. Thao tác này ghi nhận khoản thu cho đơn hàng.</p>
  </div>;
}

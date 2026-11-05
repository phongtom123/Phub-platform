"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shoppingRequest, validateInvoice, validateOrders } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import type { InvoiceOverview, OrderPage, OrderSummary } from "@/lib/shopping/types";
import { orderStatus } from "@/components/shopping/OrderHistory";
import styles from "./contact.module.css";

type Snapshot = {
  key: string;
  orders: OrderPage | null;
  invoices: Record<string, InvoiceOverview>;
  invoiceErrors: Record<string, string>;
  error: string;
};

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Chưa có ngày" : parsed.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function SupportOrderPicker({ accountId, selectedOrderId, disabled, onSelect }: {
  accountId: string;
  selectedOrderId: string;
  disabled: boolean;
  onSelect: (order: OrderSummary) => void;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([accountId, page, revision]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = snapshot?.key === key ? snapshot : null;
  const loading = !current;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const orders = await shoppingRequest(`orders?page=${page}&page_size=5`, { signal: controller.signal }, validateOrders);
        if (controller.signal.aborted) return;
        setSnapshot({ key, orders, invoices: {}, invoiceErrors: {}, error: "" });
        const queue = [...orders.items];
        // Read only this page, with two requests at a time on the free backend.
        async function worker() {
          while (queue.length && !controller.signal.aborted) {
            const order = queue.shift()!;
            try {
              const invoice = await shoppingRequest(`orders/${encodeURIComponent(order.id)}/invoice`, { signal: controller.signal }, validateInvoice);
              if (invoice.order_id !== order.id) throw new Error("Hóa đơn không khớp đơn hàng.");
              if (!controller.signal.aborted) setSnapshot(previous => previous?.key === key ? {
                ...previous, invoices: { ...previous.invoices, [order.id]: invoice },
              } : previous);
            } catch (cause) {
              if (!controller.signal.aborted) setSnapshot(previous => previous?.key === key ? {
                ...previous, invoiceErrors: { ...previous.invoiceErrors, [order.id]: cause instanceof Error ? cause.message : "Chưa tải được hóa đơn." },
              } : previous);
            }
          }
        }
        await Promise.all([worker(), worker()]);
      } catch (cause) {
        if (!controller.signal.aborted) setSnapshot({
          key, orders: null, invoices: {}, invoiceErrors: {},
          error: cause instanceof Error ? cause.message : "Chưa tải được đơn hàng.",
        });
      }
    }
    void load();
    return () => controller.abort();
  }, [accountId, page, key]);

  return <section className={styles.orderPicker} aria-label="Hóa đơn và đơn hàng của bạn">
    <div className={styles.orderPickerHeading}>
      <h2>Hóa đơn & đơn hàng của bạn</h2>
      <button type="button" className={styles.refreshBtn} disabled={loading || disabled} onClick={() => setRevision(value => value + 1)}>Làm mới</button>
    </div>
    <p className={styles.orderPickerHint}>Bấm chọn đơn cần hỗ trợ để tự điền vào phiếu. Không cần chọn đơn nếu bạn chỉ cần tư vấn.</p>
    {loading && <p role="status">Đang tải đơn hàng…</p>}
    {current?.error && <div role="alert" className={styles.errorText}>
      <p>{current.error}</p>
      <button type="button" className={styles.refreshBtn} disabled={disabled} onClick={() => setRevision(value => value + 1)}>Thử lại</button>
    </div>}
    {current?.orders && <>
      {!current.orders.items.length && <p className={styles.orderPickerHint}>Chưa có đơn hàng trên trang này. Bạn vẫn có thể gửi yêu cầu hỗ trợ.</p>}
      <div className={styles.supportOrderList}>{current.orders.items.map(order => {
        const overview = current.invoices[order.id];
        const invoiceError = current.invoiceErrors[order.id];
        const selected = order.id === selectedOrderId.trim();
        return <article className={styles.supportOrderCard} key={order.id}>
          <button type="button" className={styles.supportOrderSelect} aria-label={`Chọn đơn ${order.id}`} aria-pressed={selected} disabled={disabled} onClick={() => onSelect(order)}>
            <span className={styles.supportOrderCode}>Đơn {order.id}</span>
            <span className={styles.orderPickerHint}>{date(order.created_at)} · {orderStatus[order.status] || orderStatus.UNKNOWN}</span>
            <span className={styles.supportOrderAmount}>Giá trị đơn <strong>{money(order.total, order.currency)}</strong></span>
            {overview ? overview.invoice ? <>
              <span className={styles.supportOrderInvoice}>Đã lập hóa đơn · {date(overview.invoice.issued_at)}</span>
              <span className={styles.supportOrderAmount}>Hóa đơn sau thuế <strong>{money(overview.invoice.total, overview.currency)}</strong></span>
            </> : <span className={styles.orderPickerHint}>Chưa có hóa đơn</span>
              : <span className={styles.orderPickerHint}>{invoiceError ? "Chưa tải được hóa đơn; vẫn có thể chọn đơn." : "Đang tải hóa đơn…"}</span>}
            <span className={styles.supportOrderChoice}>{selected ? "✓ Đã chọn để tạo phiếu" : "Chọn đơn này để tạo phiếu →"}</span>
          </button>
          <Link className={styles.supportOrderLink} href={`/main/orders/${encodeURIComponent(order.id)}`}>Xem chi tiết đơn & hóa đơn</Link>
        </article>;
      })}</div>
      {current.orders.pagination.total_pages > 1 && <nav className={styles.orderPickerPager} aria-label="Phân trang đơn hàng hỗ trợ">
        <button type="button" disabled={disabled || page <= 1} onClick={() => setPage(value => value - 1)}>Trang trước</button>
        <span>{page} / {current.orders.pagination.total_pages}</span>
        <button type="button" disabled={disabled || page >= current.orders!.pagination.total_pages} onClick={() => setPage(value => value + 1)}>Trang sau</button>
      </nav>}
    </>}
  </section>;
}

"use client";
import { useEffect } from "react";
import { validateInvoice } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import { useCustomerResource } from "./useCustomerResource";
import styles from "./shopping.module.css";

export function InvoicePanel({ orderId }: { orderId: string }) {
  const resource = useCustomerResource(`orders/${encodeURIComponent(orderId)}/invoice`, validateInvoice);
  const data = resource.data;
  useEffect(() => {
    window.addEventListener("phub:invoice-changed", resource.reload);
    return () => window.removeEventListener("phub:invoice-changed", resource.reload);
  }, [resource.reload]);
  return <section className={styles.panel} aria-label="Hóa đơn của đơn hàng">
    <h2>Hóa đơn</h2>
    <button type="button" disabled={resource.loading} onClick={resource.reload}>Cập nhật hóa đơn</button>
    {resource.loading && <p role="status">Đang tải hóa đơn…</p>}
    {resource.error && <p role="alert" className={styles.error}>{resource.error}</p>}
    {data && !data.invoice && <p>Đơn chưa có hóa đơn được lập.</p>}
    {data?.invoice && <>
      <p>Lập lúc: {data.invoice.issued_at.replace("T", " ")}</p>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Giảm giá</th><th>Thành tiền trên đơn</th></tr></thead>
        <tbody>{data.items.map((line, index) => <tr key={index}>
          <td>{line.name}</td><td>{line.quantity}</td><td>{money(line.unit_price, data.currency)}</td>
          <td>{money(line.discount, data.currency)}</td><td>{money(line.line_total, data.currency)}</td>
        </tr>)}</tbody>
      </table></div>
      <div className={styles.totals}>
        <p>Giảm giá <strong>{money(data.invoice.discount_total, data.currency)}</strong></p>
        <p>Tổng trước thuế <strong>{money(data.invoice.subtotal, data.currency)}</strong></p>
        <p>Thuế <strong>{money(data.invoice.tax_total, data.currency)}</strong></p>
        <p className={styles.total}>Tổng hóa đơn sau thuế <strong>{money(data.invoice.total, data.currency)}</strong></p>
      </div>
      <p className={styles.muted}>Các dòng sản phẩm lấy từ thông tin đã chốt trên đơn; tổng hóa đơn lấy từ hóa đơn đã lập.</p>
    </>}
  </section>;
}

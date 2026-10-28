"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/common/Button";
import { useAccountResource } from "@/lib/account/useAccountResource";
import { formatDate, formatMoney, orderStatus, paymentMethod, paymentStatus, parseInvoice, parseOrder, parsePayment, parseTransactions, type OrderLine, type Pagination, type Transaction } from "@/lib/account/client";
import styles from "./profile.module.css";

export function DataState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (loading) return <p className={styles.note} role="status">Đang tải dữ liệu…</p>;
  if (error) return <div className={styles.error} role="alert"><p>{error}</p><Button variant="outline" onClick={reload}>Thử lại</Button></div>;
  return null;
}
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className={styles.panel} aria-label={title}><div className={styles.panelHeading}><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Pager({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  if (!pagination.total_pages) return null;
  return <nav className={styles.pager} aria-label="Phân trang"><Button variant="outline" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Trang trước</Button><span>Trang {pagination.page} / {pagination.total_pages} · {pagination.total} bản ghi</span><Button variant="outline" disabled={pagination.page >= pagination.total_pages} onClick={() => onPage(pagination.page + 1)}>Trang sau</Button></nav>;
}
function Lines({ items, currency }: { items: OrderLine[]; currency: string }) {
  if (!items.length) return <p className={styles.note}>Chưa có dòng sản phẩm.</p>;
  return <div className={styles.tableScroll} role="region" aria-label="Chi tiết sản phẩm trong đơn" tabIndex={0}><table className={styles.table}>
    <thead><tr><th scope="col">Sản phẩm / SKU</th><th scope="col">Số lượng</th><th scope="col">Đơn giá</th><th scope="col">Giảm giá</th><th scope="col">Thuế dòng</th><th scope="col">Thành tiền</th></tr></thead>
    <tbody>{items.map((line, index) => <tr key={`${line.sku}:${index}`}><td>{line.name}<small>{line.sku}</small></td><td>{line.quantity} {line.unit}</td><td>{formatMoney(line.unit_price, currency)}</td><td>{formatMoney(line.discount, currency)}</td><td>{formatMoney(line.tax_amount, currency)}</td><td>{formatMoney(line.line_total, currency)}</td></tr>)}</tbody>
  </table></div>;
}
export function OrderPanel({ orderId }: { orderId: string }) {
  const resource = useAccountResource(`customer/orders/${encodeURIComponent(orderId)}`, parseOrder);
  const order = resource.data;
  return <Panel title={`Chi tiết đơn ${orderId}`} action={<Button variant="outline" onClick={resource.reload} disabled={resource.loading}>Làm mới đơn</Button>}>
    <DataState {...resource} />
    {order && <><dl className={styles.infoGrid}>
      <div><dt>Trạng thái đơn</dt><dd><span className={styles.badge}>{orderStatus[order.status] ?? "Chưa xác định"}</span></dd></div>
      <div><dt>Ngày đặt</dt><dd>{formatDate(order.created_at)}</dd></div>
      <div><dt>Người nhận</dt><dd>{order.recipient.name || "Chưa có thông tin"}<small>{order.recipient.phone}</small></dd></div>
      <div><dt>Địa chỉ trên đơn</dt><dd>{[order.recipient.address_line, order.recipient.ward, order.recipient.province].filter(Boolean).join(", ") || "Chưa có thông tin"}</dd></div>
    </dl><Lines items={order.items} currency={order.currency} /><p className={styles.total}>Tổng giá trị đơn: <strong>{formatMoney(order.total, order.currency)}</strong></p><p className={styles.note}>Tổng theo các dòng đơn đã chốt, không phải số tiền đã thu. Thuế hóa đơn được hiển thị riêng.</p>{order.note && <p className={styles.note}>Ghi chú: {order.note}</p>}</>}
  </Panel>;
}
export function InvoicePanel({ orderId }: { orderId: string }) {
  const resource = useAccountResource(`customer/orders/${encodeURIComponent(orderId)}/invoice`, parseInvoice);
  const data = resource.data;
  return <Panel title={`Hóa đơn của ${orderId}`} action={<Button variant="outline" onClick={resource.reload} disabled={resource.loading}>Làm mới hóa đơn</Button>}>
    <DataState {...resource} />
    {data && (data.invoice ? <><dl className={styles.infoGrid}>
      <div><dt>Ngày lập</dt><dd>{formatDate(data.invoice.issued_at)}</dd></div>
      <div><dt>Tiền trước thuế</dt><dd>{formatMoney(data.invoice.subtotal, data.currency)}</dd></div>
      <div><dt>Giảm giá</dt><dd>{formatMoney(data.invoice.discount_total, data.currency)}</dd></div>
      <div><dt>Tiền thuế</dt><dd>{formatMoney(data.invoice.tax_total, data.currency)}</dd></div>
    </dl><Lines items={data.items} currency={data.currency} /><p className={styles.total}>Tổng hóa đơn: <strong>{formatMoney(data.invoice.total, data.currency)}</strong></p><p className={styles.note}>Số tiền được lấy nguyên từ hóa đơn; giao diện không cộng thuế lần nữa.</p></> : <p className={styles.empty}>Đơn này chưa được lập hóa đơn.</p>)}
  </Panel>;
}
function TransactionInfo({ transaction, currency }: { transaction: Transaction; currency: string }) {
  return <><dl className={styles.infoGrid}>
    <div><dt>Loại giao dịch</dt><dd>{transaction.type === "collection" ? "Thu tiền" : transaction.type === "refund" ? "Hoàn tiền" : "Chưa xác định"}</dd></div>
    <div><dt>Phương thức</dt><dd>{paymentMethod[transaction.method] ?? "Chưa xác định"}</dd></div>
    <div><dt>Số tiền giao dịch</dt><dd>{formatMoney(transaction.amount, currency)}</dd></div>
    <div><dt>Trạng thái giao dịch</dt><dd><span className={styles.badge}>{paymentStatus[transaction.status] ?? "Chưa xác định"}</span></dd></div>
    <div><dt>Thời gian</dt><dd>{formatDate(transaction.occurred_at)}</dd></div>
  </dl><p className={styles.note}>{transaction.message}</p></>;
}
export function PaymentPanels({ orderId }: { orderId: string }) {
  const [page, setPage] = useState(1);
  const payment = useAccountResource(`orders/${encodeURIComponent(orderId)}/payments`, parsePayment);
  const history = useAccountResource(`orders/${encodeURIComponent(orderId)}/transactions?page=${page}&page_size=10`, parseTransactions);
  return <>
    <Panel title={`Thanh toán của ${orderId}`} action={<Button variant="outline" disabled={payment.loading || history.loading} onClick={() => { payment.reload(); history.reload(); }}>Làm mới thanh toán</Button>}>
      <DataState {...payment} />
      {payment.data && <>{payment.data.latest_transaction ? <TransactionInfo transaction={payment.data.latest_transaction} currency={payment.data.currency} /> : <p className={styles.empty}>Chưa có giao dịch thanh toán.</p>}<p className={styles.note}>{payment.data.message}</p><p className={styles.notice}>Đây là giao dịch mới nhất, có thể là thu hoặc hoàn tiền; không phải kết luận đã tất toán toàn đơn.</p></>}
    </Panel>
    <Panel title="Lịch sử thu / hoàn tiền">
      <DataState {...history} />
      {history.data && <>{history.data.items.length ? <ol className={styles.transactions}>{history.data.items.map((item, index) => <li key={`${page}:${index}`}><TransactionInfo transaction={item} currency={history.data!.currency} /></li>)}</ol> : <p className={styles.empty}>Chưa có giao dịch trên trang này.</p>}<Pager pagination={history.data.pagination} onPage={setPage} /></>}
    </Panel>
  </>;
}

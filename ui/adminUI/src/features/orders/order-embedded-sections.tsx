"use client";

import Link from "next/link";
import { Clock3, CreditCard, FileClock, Package, Printer, ReceiptText, TicketPercent } from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import { inlineChoiceLabel, type DataRow } from "../../lib/inline-table-data";
import { formatMoney } from "../operations/financial-summary";
import { ScrollableTable } from "../tables/scrollable-table";
import type { AdminOrderDetailData } from "./order-detail-data";
import { addOrderMoney, orderDate, subtractOrderMoney, sumOrderMoney } from "./order-detail-format";
import styles from "./order-detail.module.css";

const actionLabels: Record<string, string> = {
  create: "Tạo đơn",
  confirm: "Xác nhận đơn",
  prepare: "Chuẩn bị hàng",
  dispatch: "Xác nhận xuất kho",
  invoice: "Lập hóa đơn",
  complete: "Hoàn thành đơn",
  cancel: "Hủy đơn",
  assign: "Phân công phụ trách",
  payment: "Ghi nhận thu tiền",
  refund: "Ghi nhận hoàn tiền",
};

function text(value: DataRow[string]) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}


function money(value: unknown) {
  return typeof value === "string" ? formatMoney(value) : "—";
}

function OrderLines({ lines }: { lines: DataRow[] }) {
  return <>
    <div className={styles.subHeading}>
      <h3 id="order-lines-title"><Package size={16} aria-hidden="true" />Sản phẩm trong đơn</h3>
      <span>{lines.length} dòng theo kho xuất</span>
    </div>
    {lines.length ? <ScrollableTable className={`${styles.orderTable} order-lines-block`} topRail={false}><table aria-labelledby="order-lines-title">
      <thead><tr><th>Sản phẩm</th><th>Kho xuất</th><th>SL</th><th>Đơn giá</th><th>Giảm giá</th><th>Thuế</th><th>Thành tiền</th></tr></thead>
      <tbody>{lines.map((line, index) => {
        const discount = addOrderMoney(line.giam_gia, line.giam_gia_voucher);
        return <tr key={String(line.ma_ct_donhang ?? index)}>
          <td><strong>{text(line.ten_sp_luc_ban)}</strong><small>{text(line.sku)} · {text(line.don_vi_luc_ban)}</small></td>
          <td>{text(line.ma_kho_xuat)}</td><td>{text(line.so_luong)}</td>
          <td>{money(line.don_gia)}</td><td>{discount === null ? "—" : formatMoney(discount)}</td>
          <td>{money(line.tien_thue)}<small>{text(line.thue_suat)}%</small></td><td><strong>{money(line.thanh_tien)}</strong></td>
        </tr>;
      })}</tbody>
    </table></ScrollableTable> : <p className={styles.empty}>Đơn hàng chưa có dòng sản phẩm.</p>}
  </>;
}

/** Vouchers recorded for the order; their amount is already inside the lines' discount. */
function VoucherNote({ uses }: { uses: DataRow[] }) {
  if (!uses.length) return null;
  return <ul className={styles.voucherList} aria-label="Voucher đã dùng">{uses.map((use, index) => {
    const cancelled = use.trang_thai === "DA_HUY";
    return <li key={String(use.ma_su_dung ?? index)} className={cancelled ? styles.voucherCancelled : undefined}>
      <TicketPercent size={15} aria-hidden="true" />
      <span>Voucher số {text(use.ma_voucher)}{cancelled ? " (đã hủy, không còn giảm)" : ""}</span>
      <strong>−{money(use.so_tien_giam)}</strong>
    </li>;
  })}</ul>;
}

/** Before an invoice exists, the order's own lines still give an exact provisional total. */
function LineTotals({ lines }: { lines: DataRow[] }) {
  if (!lines.length) return null;
  const discount = sumOrderMoney(lines.flatMap(line => [line.giam_gia ?? "0", line.giam_gia_voucher ?? "0"]));
  const tax = sumOrderMoney(lines.map(line => line.tien_thue ?? "0"));
  const total = sumOrderMoney(lines.map(line => line.thanh_tien));
  const beforeTax = total === null || tax === null ? null : subtractOrderMoney(total, tax);
  return <dl className={`${styles.invoiceTotals} ${styles.provisional}`}>
    <div><dt>Giảm giá</dt><dd>{discount === null ? "—" : formatMoney(discount)}</dd></div>
    <div><dt>Trước thuế</dt><dd>{beforeTax === null ? "—" : formatMoney(beforeTax)}</dd></div>
    <div><dt>Tiền thuế</dt><dd>{tax === null ? "—" : formatMoney(tax)}</dd></div>
    <div><dt>Tạm tính</dt><dd>{total === null ? "—" : formatMoney(total)}</dd></div>
  </dl>;
}

/** Invoice header, product lines and totals in one card, so the whole invoice reads without scrolling. */
function InvoiceBlock({ orderId, orderStatus, invoice, lines, vouchers }: {
  orderId: string; orderStatus: string; invoice: DataRow | null; lines: DataRow[]; vouchers: DataRow[];
}) {
  if (!invoice) return <section className={`${styles.card} order-invoice-block`} aria-labelledby="order-invoice-title">
    <div className={styles.sectionHeading}><div><h2 id="order-invoice-title"><ReceiptText size={18} aria-hidden="true" />Hóa đơn</h2>
      <p>Chưa lập hóa đơn. Số tiền dưới đây là tạm tính từ các dòng sản phẩm; dùng “Lập hóa đơn” ở đầu trang khi đơn đủ điều kiện.</p></div></div>
    <OrderLines lines={lines} />
    <LineTotals lines={lines} />
    <VoucherNote uses={vouchers} />
  </section>;

  const invoiceId = text(invoice.ma_hoadon);
  const source = inlineChoiceLabel("nguon_lap", invoice.nguon_lap);
  const creator = invoice.nguoi_lap ? `Nhân viên ${String(invoice.nguoi_lap)}`
    : invoice.ma_tk_lap ? `Tự động theo tài khoản ${String(invoice.ma_tk_lap)}` : source;
  const invoiceHref = typeof invoice.ma_hoadon === "string" && invoice.ma_hoadon
    ? dataHref("invoices", { orderId, key: JSON.stringify([invoice.ma_hoadon]) }) : dataHref("invoices", { orderId });
  const print = () => {
    document.body.classList.add("phub-order-invoice-print");
    try { window.print(); } finally { document.body.classList.remove("phub-order-invoice-print"); }
  };

  return <section className={`${styles.card} ${styles.invoiceCard} order-invoice-block`} aria-labelledby="order-invoice-title">
    <div className={styles.sectionHeading}>
      <div><h2 id="order-invoice-title"><ReceiptText size={18} aria-hidden="true" />Hóa đơn {invoiceId}</h2>
        <p>Lập lúc {orderDate(invoice.thoi_gian_lap)} · {creator} · {source}</p></div>
      <div className={`${styles.sectionActions} order-invoice-actions`}>
        <button type="button" onClick={print}><Printer size={16} aria-hidden="true" />In / lưu PDF</button>
        <Link href={invoiceHref}>Mở trang tra cứu</Link>
      </div>
    </div>
    {orderStatus === "HUY" && <p className={styles.cancelledInvoice}>ĐƠN HÀNG ĐÃ HỦY — Hóa đơn giữ để đối chiếu, không dùng thu tiền.</p>}
    <dl className={styles.invoiceMeta}>
      <div><dt>Người mua</dt><dd>{text(invoice.ten_nguoi_mua)}</dd></div>
      <div><dt>Địa chỉ</dt><dd>{text(invoice.dia_chi_nguoi_mua)}</dd></div>
    </dl>
    <OrderLines lines={lines} />
    <dl className={styles.invoiceTotals}>
      <div><dt>Giảm giá</dt><dd>{money(invoice.tong_tien_giam)}</dd></div>
      <div><dt>Trước thuế</dt><dd>{money(invoice.tong_tien_truoc_thue)}</dd></div>
      <div><dt>Tiền thuế</dt><dd>{money(invoice.tong_tien_thue)}</dd></div>
      <div><dt>Tổng sau thuế</dt><dd>{money(invoice.tong_tien_sau_thue)}</dd></div>
    </dl>
    <VoucherNote uses={vouchers} />
  </section>;
}

function Payments({ payments }: { payments: DataRow[] }) {
  const rows = [...payments].sort((a, b) => {
    const time = Date.parse(String(b.thoi_gian ?? "")) - Date.parse(String(a.thoi_gian ?? ""));
    return (Number.isFinite(time) ? time : 0) || Number(b.ma_thanh_toan ?? 0) - Number(a.ma_thanh_toan ?? 0);
  });
  return <section className={styles.card} aria-labelledby="order-payments-title">
    <h2 id="order-payments-title" className={styles.cardTitle}><CreditCard size={18} aria-hidden="true" />Lịch sử thu và hoàn tiền</h2>
    {rows.length ? <ul className={styles.paymentList}>{rows.map((payment, index) => {
      const refund = payment.loai_giao_dich === "HOAN_TIEN";
      return <li key={String(payment.ma_thanh_toan ?? index)}>
        <span className={`${styles.transactionType} ${refund ? styles.refund : styles.collection}`}>{inlineChoiceLabel("loai_giao_dich", payment.loai_giao_dich)}</span>
        <span className={styles.paymentInfo}>{orderDate(payment.thoi_gian)} · {inlineChoiceLabel("phuong_thuc", payment.phuong_thuc)} · {inlineChoiceLabel("trang_thai", payment.trang_thai)}
          {" · "}{payment.ma_tk_ghi_nhan ? `Tài khoản ${String(payment.ma_tk_ghi_nhan)}` : payment.la_bypass ? "Ghi nhận trực tiếp" : "Hệ thống thanh toán"}</span>
        <strong className={refund ? styles.negativeMoney : undefined}>{refund ? "−" : "+"}{money(payment.so_tien)}</strong>
      </li>;
    })}</ul> : <p className={styles.empty}>Chưa có giao dịch thu hoặc hoàn tiền.</p>}
  </section>;
}

function ProcessingHistory({ history }: { history: AdminOrderDetailData["history"] }) {
  return <>
    <div className={styles.subHeading}><h3 id="order-history-title"><FileClock size={16} aria-hidden="true" />Lịch sử xử lý</h3></div>
    {history.length ? <ol className={styles.timeline} aria-labelledby="order-history-title">{history.map((event, index) => <li key={event.key || `${event.occurred_at}:${index}`}>
      <span className={styles.timelineIcon}><Clock3 size={15} aria-hidden="true" /></span>
      <div><div className={styles.timelineHeading}><strong>{actionLabels[event.action] ?? event.action}</strong><time dateTime={event.occurred_at}>{orderDate(event.occurred_at)}</time></div>
        <p>Thực hiện bởi <strong>{event.actor_name || event.actor_id || "Không có dữ liệu người thực hiện"}</strong>{event.actor_name && event.actor_id ? ` (${event.actor_id})` : ""}.</p>
        {(event.from_status || event.to_status) && <p className={styles.transition}>Trạng thái: {event.from_status ? inlineChoiceLabel("trang_thai", event.from_status) : "—"} → {event.to_status ? inlineChoiceLabel("trang_thai", event.to_status) : "—"}</p>}
      </div>
    </li>)}</ol> : <p className={styles.empty}>Chưa có lịch sử thao tác được ghi nhận.</p>}
  </>;
}

export function OrderInvoiceSection({ detail }: { detail: AdminOrderDetailData }) {
  return <InvoiceBlock orderId={detail.order_id} orderStatus={String(detail.order.trang_thai ?? "")} invoice={detail.invoice} lines={detail.lines}
    vouchers={Array.isArray(detail.voucher_uses) ? detail.voucher_uses : []} />;
}

export function OrderPayments({ detail }: { detail: AdminOrderDetailData }) {
  return <Payments payments={detail.payments} />;
}

/** Timeline placed inside the processing card, under the staff and time rows. */
export function OrderHistory({ detail }: { detail: AdminOrderDetailData }) {
  return <ProcessingHistory history={Array.isArray(detail.history) ? detail.history : []} />;
}

"use client";

import Link from "next/link";
import { Clock3, CreditCard, FileClock, Package, Printer, ReceiptText } from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import { inlineChoiceLabel, type DataRow } from "../../lib/inline-table-data";
import { formatMoney } from "../operations/financial-summary";
import { ScrollableTable } from "../tables/scrollable-table";
import type { AdminOrderDetailData } from "./order-detail-data";
import { addOrderMoney, orderDate } from "./order-detail-format";
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
  return <section className={`${styles.card} ${styles.tableCard} order-lines-block`} aria-labelledby="order-lines-title">
    <div className={styles.sectionHeading}>
      <div><h2 id="order-lines-title"><Package size={20} aria-hidden="true" />Sản phẩm trong đơn</h2>
        <p>{lines.length} dòng theo kho xuất; không gộp dữ liệu giữ và xuất hàng.</p></div>
    </div>
    {lines.length ? <ScrollableTable className={styles.orderTable}><table>
      <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Kho xuất</th><th>SL</th><th>Đơn giá</th><th>Giảm giá</th><th>Thuế</th><th>Thành tiền</th></tr></thead>
      <tbody>{lines.map((line, index) => {
        const discount = addOrderMoney(line.giam_gia, line.giam_gia_voucher);
        return <tr key={String(line.ma_ct_donhang ?? index)}>
          <td><strong>{text(line.ten_sp_luc_ban)}</strong><small>{text(line.don_vi_luc_ban)}</small></td>
          <td>{text(line.sku)}</td><td>{text(line.ma_kho_xuat)}</td><td>{text(line.so_luong)}</td>
          <td>{money(line.don_gia)}</td><td>{discount === null ? "—" : formatMoney(discount)}</td>
          <td>{money(line.tien_thue)}<small>{text(line.thue_suat)}%</small></td><td><strong>{money(line.thanh_tien)}</strong></td>
        </tr>;
      })}</tbody>
    </table></ScrollableTable> : <p className={styles.empty}>Đơn hàng chưa có dòng sản phẩm.</p>}
  </section>;
}

function InvoiceBlock({ orderId, orderStatus, invoice, lines }: {
  orderId: string; orderStatus: string; invoice: DataRow | null; lines: DataRow[];
}) {
  if (!invoice) return <section className={`${styles.card} order-invoice-block`} aria-labelledby="order-invoice-title">
    <div className={styles.sectionHeading}><div><h2 id="order-invoice-title"><ReceiptText size={20} aria-hidden="true" />Hóa đơn</h2>
      <p>Chưa có hóa đơn cho đơn hàng này.</p></div></div>
    <p className={styles.empty}>Dùng thao tác “Lập hóa đơn” ở đầu trang khi đơn đủ điều kiện.</p>
  </section>;

  const invoiceId = text(invoice.ma_hoadon);
  const source = inlineChoiceLabel("nguon_lap", invoice.nguon_lap);
  const creator = invoice.nguoi_lap ? `Nhân viên ${String(invoice.nguoi_lap)}`
    : invoice.ma_tk_lap ? `Tài khoản ${String(invoice.ma_tk_lap)}` : source;
  const invoiceHref = typeof invoice.ma_hoadon === "string" && invoice.ma_hoadon
    ? dataHref("invoices", { orderId, key: JSON.stringify([invoice.ma_hoadon]) }) : dataHref("invoices", { orderId });
  const print = () => {
    document.body.classList.add("phub-order-invoice-print");
    try { window.print(); } finally { document.body.classList.remove("phub-order-invoice-print"); }
  };

  return <section className={`${styles.card} ${styles.invoiceCard} order-invoice-block`} aria-labelledby="order-invoice-title">
    <div className={styles.sectionHeading}>
      <div><h2 id="order-invoice-title"><ReceiptText size={20} aria-hidden="true" />Hóa đơn {invoiceId}</h2>
        <p>Hóa đơn đã lập · {source}</p></div>
      <div className={`${styles.sectionActions} order-invoice-actions`}>
        <button type="button" onClick={print}><Printer size={16} aria-hidden="true" />In / lưu PDF</button>
        <Link href={invoiceHref}>Mở trang tra cứu</Link>
      </div>
    </div>
    {orderStatus === "HUY" && <p className={styles.cancelledInvoice}>ĐƠN HÀNG ĐÃ HỦY — Hóa đơn giữ để đối chiếu, không dùng thu tiền.</p>}
    <dl className={styles.invoiceMeta}>
      <div><dt>Mã hóa đơn</dt><dd>{invoiceId}</dd></div>
      <div><dt>Ngày lập</dt><dd>{orderDate(invoice.thoi_gian_lap)}</dd></div>
      <div><dt>Người / nguồn lập</dt><dd>{creator} · {source}</dd></div>
      <div><dt>Người mua</dt><dd>{text(invoice.ten_nguoi_mua)}</dd></div>
      <div className={styles.invoiceAddress}><dt>Địa chỉ người mua</dt><dd>{text(invoice.dia_chi_nguoi_mua)}</dd></div>
    </dl>
    <dl className={styles.invoiceTotals}>
      <div><dt>Giảm giá</dt><dd>{money(invoice.tong_tien_giam)}</dd></div>
      <div><dt>Trước thuế</dt><dd>{money(invoice.tong_tien_truoc_thue)}</dd></div>
      <div><dt>Tiền thuế</dt><dd>{money(invoice.tong_tien_thue)}</dd></div>
      <div><dt>Tổng sau thuế</dt><dd>{money(invoice.tong_tien_sau_thue)}</dd></div>
    </dl>
    <p className={styles.printLineCount}>Hóa đơn gồm {lines.length} dòng sản phẩm theo kho xuất, chi tiết ở bảng sản phẩm bên dưới.</p>
  </section>;
}

function Payments({ payments }: { payments: DataRow[] }) {
  const rows = [...payments].sort((a, b) => {
    const time = Date.parse(String(b.thoi_gian ?? "")) - Date.parse(String(a.thoi_gian ?? ""));
    return (Number.isFinite(time) ? time : 0) || Number(b.ma_thanh_toan ?? 0) - Number(a.ma_thanh_toan ?? 0);
  });
  return <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="order-payments-title">
    <div className={styles.sectionHeading}><div><h2 id="order-payments-title"><CreditCard size={20} aria-hidden="true" />Lịch sử thu và hoàn tiền</h2>
      <p>Chỉ các giao dịch thành công được tính vào số tổng hợp phía trên.</p></div></div>
    {rows.length ? <ScrollableTable className={styles.orderTable}><table>
      <thead><tr><th>Thời điểm</th><th>Loại</th><th>Phương thức</th><th>Trạng thái</th><th>Số tiền</th><th>Nguồn ghi nhận</th></tr></thead>
      <tbody>{rows.map((payment, index) => {
        const refund = payment.loai_giao_dich === "HOAN_TIEN";
        return <tr key={String(payment.ma_thanh_toan ?? index)}>
          <td>{orderDate(payment.thoi_gian)}</td>
          <td><span className={`${styles.transactionType} ${refund ? styles.refund : styles.collection}`}>{inlineChoiceLabel("loai_giao_dich", payment.loai_giao_dich)}</span></td>
          <td>{inlineChoiceLabel("phuong_thuc", payment.phuong_thuc)}</td>
          <td>{inlineChoiceLabel("trang_thai", payment.trang_thai)}</td>
          <td className={refund ? styles.negativeMoney : undefined}>{refund ? "−" : "+"}{money(payment.so_tien)}</td>
          <td>{payment.ma_tk_ghi_nhan ? `Admin · ${String(payment.ma_tk_ghi_nhan)}` : payment.la_bypass ? "Bypass" : "Hệ thống thanh toán"}</td>
        </tr>;
      })}</tbody>
    </table></ScrollableTable> : <p className={styles.empty}>Chưa có giao dịch thu hoặc hoàn tiền cho đơn hàng này.</p>}
  </section>;
}

function ProcessingHistory({ history }: { history: AdminOrderDetailData["history"] }) {
  return <section className={styles.card} aria-labelledby="order-history-title">
    <div className={styles.sectionHeading}><div><h2 id="order-history-title"><FileClock size={20} aria-hidden="true" />Lịch sử xử lý</h2>
      <p>Thao tác thành công đã được hệ thống ghi nhận cho đúng đơn hàng.</p></div></div>
    {history.length ? <ol className={styles.timeline}>{history.map((event, index) => <li key={event.key || `${event.occurred_at}:${index}`}>
      <span className={styles.timelineIcon}><Clock3 size={15} aria-hidden="true" /></span>
      <div><div className={styles.timelineHeading}><strong>{actionLabels[event.action] ?? event.action}</strong><time dateTime={event.occurred_at}>{orderDate(event.occurred_at)}</time></div>
        <p>Thực hiện bởi <strong>{event.actor_name || event.actor_id || "Không có dữ liệu người thực hiện"}</strong>{event.actor_name && event.actor_id ? ` (${event.actor_id})` : ""}.</p>
        {(event.from_status || event.to_status) && <p className={styles.transition}>Trạng thái: {event.from_status ? inlineChoiceLabel("trang_thai", event.from_status) : "—"} → {event.to_status ? inlineChoiceLabel("trang_thai", event.to_status) : "—"}</p>}
      </div>
    </li>)}</ol> : <p className={styles.empty}>Chưa có lịch sử thao tác thành công được ghi nhận; hệ thống không tự dựng lại lịch sử cũ.</p>}
  </section>;
}

export function OrderEmbeddedSections({ detail }: { detail: AdminOrderDetailData }) {
  const history = Array.isArray(detail.history) ? detail.history : [];
  return <>
    <InvoiceBlock orderId={detail.order_id} orderStatus={String(detail.order.trang_thai ?? "")} invoice={detail.invoice} lines={detail.lines} />
    <OrderLines lines={detail.lines} />
    <div className={styles.historyGrid}>
      <Payments payments={detail.payments} />
      <ProcessingHistory history={history} />
    </div>
  </>;
}

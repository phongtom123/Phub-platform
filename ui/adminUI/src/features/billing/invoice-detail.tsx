import Link from "next/link";
import { ArrowUpRight, CalendarDays, CreditCard, FileText, ReceiptText, ShoppingBag, UserRound, Wallet } from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import type { DataColumn, DataRow } from "../../lib/inline-table-data";
import styles from "./invoice-detail.module.css";

type Props = { row: DataRow; columns: DataColumn[]; label: (field: string) => string };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const handledFields = new Set([
  "ma_hoadon", "ma_donhang", "thoi_gian_lap", "ten_nguoi_mua", "ma_so_thue", "dia_chi_nguoi_mua",
  "nguoi_lap", "tong_tien_giam", "tong_tien_truoc_thue", "tong_tien_thue", "tong_tien_sau_thue",
]);
const text = (value: DataRow[string]) => value === null || value === undefined || value === "" ? "—" : String(value);

/** Format the API's decimal string directly, preserving every digit. No totals are recalculated. */
function money(value: DataRow[string]) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? ""));
  if (!match) return "—";
  const integer = match[2].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  return `${match[1]}${integer}${fraction ? "," + fraction : ""} ₫`;
}

function invoiceDate(value: DataRow[string]) {
  if (!value) return "—";
  const input = String(value);
  const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(input) ? input : input + "+07:00");
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Thời gian không hợp lệ";
}

export function InvoiceDetail({ row, columns, label }: Props) {
  const orderId = typeof row.ma_donhang === "string" && row.ma_donhang ? row.ma_donhang : null;
  const orderHref = orderId ? dataHref("orders", { key: JSON.stringify([orderId]) }) : null;
  const extraColumns = columns.filter(column => !handledFields.has(column.name));

  return <div className={`invoice-detail ${styles.detail}`}>
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <span className={styles.invoiceIcon}><ReceiptText size={26} aria-hidden="true" /></span>
        <div className={`live-field ${styles.title}`}><p>Chi tiết hóa đơn</p><h1>{text(row.ma_hoadon)}</h1></div>
      </div>
      <div className={`live-field ${styles.issued}`}>
        <CalendarDays size={18} aria-hidden="true" />
        <div><span>Thời gian lập</span><strong>{invoiceDate(row.thoi_gian_lap)}</strong></div>
      </div>
    </header>

    <div className={styles.grid}>
      <div className={styles.information}>
        <section className={styles.card} aria-labelledby="invoice-buyer-title">
          <h2 id="invoice-buyer-title"><UserRound size={20} aria-hidden="true" />Thông tin người mua</h2>
          <div className={`live-field ${styles.buyer}`}>
            <span className={styles.avatar}><UserRound size={22} aria-hidden="true" /></span>
            <div><span className={styles.caption}>Tên người mua</span><p>{text(row.ten_nguoi_mua)}</p></div>
          </div>
          <dl className={styles.fields}>
            <div className={`live-field ${styles.field}`}><dt>Mã số thuế</dt><dd>{text(row.ma_so_thue)}</dd></div>
            <div className={`live-field ${styles.field}`}><dt>Địa chỉ người mua</dt><dd>{text(row.dia_chi_nguoi_mua)}</dd></div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="invoice-record-title">
          <h2 id="invoice-record-title"><FileText size={20} aria-hidden="true" />Thông tin lập hóa đơn</h2>
          <dl className={styles.fields}>
            <div className={`live-field ${styles.field}`}><dt>Mã đơn hàng</dt><dd>{orderHref ? <Link href={orderHref}>{orderId}</Link> : "—"}</dd></div>
            <div className={`live-field ${styles.field}`}><dt>Người lập</dt><dd>{row.nguoi_lap
              ? <Link href={dataHref("employees", { key: JSON.stringify([row.nguoi_lap]) })}>{String(row.nguoi_lap)}</Link> : "—"}</dd></div>
          </dl>
        </section>
      </div>

      <section className={`${styles.card} ${styles.summary}`} aria-labelledby="invoice-value-title">
        <h2 id="invoice-value-title"><Wallet size={20} aria-hidden="true" />Giá trị hóa đơn</h2>
        <dl className={styles.amounts}>
          <div className={`live-field ${styles.amount} ${styles.discount}`}><dt>Tổng tiền giảm</dt><dd>{money(row.tong_tien_giam)}</dd></div>
          <div className={`live-field ${styles.amount}`}><dt>Tổng trước thuế</dt><dd>{money(row.tong_tien_truoc_thue)}</dd></div>
          <div className={`live-field ${styles.amount}`}><dt>Tiền thuế</dt><dd>{money(row.tong_tien_thue)}</dd></div>
          <div className={`live-field ${styles.total}`}><dt>Tổng sau thuế</dt><dd>{money(row.tong_tien_sau_thue)}</dd></div>
        </dl>
        <p className={styles.summaryNote}>Tổng trước thuế là tiền hàng sau giảm giá.</p>
      </section>
    </div>

    {extraColumns.length > 0 && <section className={styles.card} aria-labelledby="invoice-extra-title">
      <h2 id="invoice-extra-title"><FileText size={20} aria-hidden="true" />Thông tin bổ sung</h2>
      <dl className={styles.fields}>{extraColumns.map(column => <div key={column.name} className={`live-field ${styles.field}`}>
        <dt>{label(column.name)}</dt><dd>{text(row[column.name])}</dd>
      </div>)}</dl>
    </section>}

    {orderId && orderHref && <section aria-labelledby="invoice-related-title">
      <div className={styles.relatedHeading}><h2 id="invoice-related-title">Hồ sơ liên quan</h2><p>Tra cứu đơn hàng và các giao dịch thanh toán</p></div>
      <nav className={styles.related} aria-label="Thông tin đơn hàng">
        <Link className={styles.relatedLink} href={orderHref} aria-label={`Đơn hàng ${orderId}`}>
          <span className={styles.relatedIcon}><ShoppingBag size={21} aria-hidden="true" /></span>
          <div><strong>Đơn hàng {orderId}</strong><span>Xem sản phẩm và thông tin giao nhận</span></div>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Link className={styles.relatedLink} href={dataHref("payments", { orderId })} aria-label="Thanh toán của đơn hàng">
          <span className={styles.relatedIcon}><CreditCard size={21} aria-hidden="true" /></span>
          <div><strong>Thanh toán của đơn hàng</strong><span>Xem lịch sử các giao dịch thanh toán</span></div>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </nav>
    </section>}
  </div>;
}

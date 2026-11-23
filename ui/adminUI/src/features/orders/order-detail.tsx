import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight, CheckCircle2, Clock3, CreditCard, FileText, Globe2,
  MapPin, Package, ReceiptText, ShoppingBag, Store, TicketPercent, XCircle,
} from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import type { DataColumn, DataRow } from "../../lib/inline-table-data";
import { orderValue } from "./order-presentation";
import styles from "./order-detail.module.css";
import { OrderFinancialSummary } from "./order-financial-summary";
import type { AdminOrderDetailData } from "./order-detail-data";
import { OrderHistory, OrderInvoiceSection, OrderPayments } from "./order-embedded-sections";

type RelatedResource = { name: string; title: string };
type Props = {
  row: DataRow; columns: DataColumn[]; related: RelatedResource[]; version: number;
  detailData?: AdminOrderDetailData; onRefresh?: () => void;
  /** The drawer header already shows the order ID and badges, so this header is skipped there. */
  hideTitle?: boolean;
  label: (field: string) => string;
  personName: (row: DataRow, field: "ma_kh" | "ma_nhan_vien") => ReactNode;
};

const relatedInfo = {
  "order-lines": { icon: Package, description: "Tra cứu riêng các dòng sản phẩm" },
  invoices: { icon: ReceiptText, description: "Tra cứu và báo cáo hóa đơn" },
  payments: { icon: CreditCard, description: "Tra cứu giao dịch thanh toán" },
  "voucher-uses": { icon: TicketPercent, description: "Tra cứu mã giảm giá đã áp dụng" },
};
const groupedFields = new Set([
  "ma_donhang", "ma_kh", "ma_nhan_vien", "kenh_ban", "trang_thai", "thoi_gian_dat",
  "thoi_gian_xuat_kho", "thoi_gian_hoan_thanh", "ten_nguoi_nhan", "sdt_nguoi_nhan",
  "dia_chi_chi_tiet", "tinh_thanh", "xa_phuong", "ghi_chu", "phuong_thuc_nhan", "email_nguoi_mua",
]);
const fieldLabels: Record<string, string> = {
  ten_nguoi_nhan: "Người nhận", sdt_nguoi_nhan: "Số điện thoại", dia_chi_chi_tiet: "Địa chỉ giao",
  email_nguoi_mua: "Email", ghi_chu: "Ghi chú", phuong_thuc_nhan: "Nhận hàng",
};
const timeLabels = { thoi_gian_dat: "Đặt lúc", thoi_gian_xuat_kho: "Xuất kho", thoi_gian_hoan_thanh: "Hoàn thành" };

/** Sales channel and status chips, shared by the page header and the drawer header. */
export function OrderBadges({ row }: { row: DataRow }) {
  const status = String(row.trang_thai ?? "");
  const complete = status === "HOAN_THANH";
  const cancelled = status === "HUY";
  const StatusIcon = complete ? CheckCircle2 : cancelled ? XCircle : Clock3;
  const ChannelIcon = row.kenh_ban === "TAI_QUAY" ? Store : Globe2;
  return <div className={styles.badges}>
    <span className={styles.channel}><ChannelIcon size={16} aria-hidden="true" />{orderValue(row, "kenh_ban")}</span>
    <span className={`${styles.status} ${complete ? styles.success : cancelled ? styles.cancelled : styles.pending}`}>
      <StatusIcon size={17} aria-hidden="true" />{orderValue(row, "trang_thai")}
    </span>
  </div>;
}

export function OrderDetail({ row, columns, related, label, personName, version, detailData, onRefresh, hideTitle }: Props) {
  const extraColumns = columns.filter(column => !groupedFields.has(column.name));
  const item = (key: string, name: ReactNode, value: ReactNode) => <div key={key} className={`live-field ${styles.row}`}>
    <dt>{name}</dt><dd>{value}</dd>
  </div>;
  const field = (name: string) => item(name, fieldLabels[name] ?? label(name), orderValue(row, name));
  const person = (name: "ma_kh" | "ma_nhan_vien", code: string) => <>
    {personName(row, name)}{row[name] && <span className={styles.identifier}>{code}: {String(row[name])}</span>}
  </>;
  const delivery = row.phuong_thuc_nhan !== "TAI_CUA_HANG";
  const address = ["dia_chi_chi_tiet", "xa_phuong", "tinh_thanh"]
    .map(name => row[name]).filter(value => value !== null && value !== undefined && value !== "").map(String).join(", ");

  return <div className={`order-detail ${styles.detail}`}>
    {!hideTitle && <header className={styles.header}>
      <div className={styles.titleGroup}>
        <span className={styles.orderIcon}><ShoppingBag size={25} aria-hidden="true" /></span>
        <div className={`live-field ${styles.title}`}>
          <p>Chi tiết đơn hàng</p>
          <h1>{orderValue(row, "ma_donhang")}</h1>
        </div>
      </div>
      <OrderBadges row={row} />
    </header>}

    <div className={styles.layout}>
      <div className={styles.mainColumn}>
        {detailData && <OrderInvoiceSection detail={detailData} />}
        <OrderFinancialSummary orderId={String(row.ma_donhang)} orderStatus={String(row.trang_thai ?? "")} version={version} financial={detailData?.financial} onRefresh={onRefresh} />
        {detailData && <OrderPayments detail={detailData} />}
      </div>

      <div className={styles.sideColumn}>
        <section className={styles.card} aria-labelledby="order-delivery-title">
          <h2 id="order-delivery-title" className={styles.cardTitle}><MapPin size={18} aria-hidden="true" />Khách hàng & giao nhận</h2>
          <dl className={styles.rows}>
            {item("ma_kh", "Khách hàng", person("ma_kh", "Mã KH"))}
            {row.phuong_thuc_nhan && field("phuong_thuc_nhan")}
            {item("nguoi_nhan", fieldLabels.ten_nguoi_nhan, <>{orderValue(row, "ten_nguoi_nhan")}
              {row.sdt_nguoi_nhan && <span className={styles.identifier}>{orderValue(row, "sdt_nguoi_nhan")}</span>}</>)}
            {row.email_nguoi_mua && field("email_nguoi_mua")}
            {delivery && item("dia_chi", fieldLabels.dia_chi_chi_tiet, address || "—")}
            {item("ghi_chu", fieldLabels.ghi_chu, row.ghi_chu ? <span className={styles.noteText}>{String(row.ghi_chu)}</span> : "Không có")}
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="order-processing-title">
          <h2 id="order-processing-title" className={styles.cardTitle}><Package size={18} aria-hidden="true" />Thông tin xử lý</h2>
          <dl className={styles.rows}>
            {item("ma_nhan_vien", "Phụ trách", person("ma_nhan_vien", "Mã NV"))}
            {Object.entries(timeLabels).map(([name, text]) => item(name, text, orderValue(row, name)))}
          </dl>
          {detailData && <OrderHistory detail={detailData} />}
        </section>

        {extraColumns.length > 0 && <section className={styles.card} aria-labelledby="order-additional-title">
          <h2 id="order-additional-title" className={styles.cardTitle}><FileText size={18} aria-hidden="true" />Thông tin bổ sung</h2>
          <dl className={styles.rows}>{extraColumns.map(column => field(column.name))}</dl>
        </section>}
      </div>
    </div>

    {!hideTitle && related.length > 0 && <section className={styles.relatedSection} aria-labelledby="order-related-title">
      <div className={styles.relatedHeading}>
        <h2 id="order-related-title">Trang tra cứu riêng</h2>
        <p>Giữ lại cho tra cứu và báo cáo; không cần rời trang này để xử lý đơn.</p>
      </div>
      <nav className={styles.related} aria-label="Thông tin đơn hàng">
        {related.map(entry => {
          const info = relatedInfo[entry.name as keyof typeof relatedInfo];
          if (!info) return null;
          const Icon = info.icon;
          return <Link key={entry.name} className={styles.relatedLink} aria-label={entry.title}
            href={dataHref(entry.name, { orderId: String(row.ma_donhang) })}>
            <span className={styles.relatedIcon}><Icon size={21} aria-hidden="true" /></span>
            <div><strong>{entry.title}</strong><span>{info.description}</span></div>
            <ArrowUpRight className={styles.linkArrow} size={18} aria-hidden="true" />
          </Link>;
        })}
      </nav>
    </section>}
  </div>;
}

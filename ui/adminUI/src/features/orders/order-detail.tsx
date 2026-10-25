import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight, CheckCircle2, Clock3, CreditCard, FileText, Globe2,
  MapPin, Package, ReceiptText, ShoppingBag, Store, TicketPercent, UserRound, XCircle,
} from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import type { DataColumn, DataRow } from "../../lib/inline-table-data";
import { orderValue } from "./order-presentation";
import styles from "./order-detail.module.css";

type RelatedResource = { name: string; title: string };
type Props = {
  row: DataRow; columns: DataColumn[]; related: RelatedResource[];
  label: (field: string) => string;
  personName: (row: DataRow, field: "ma_kh" | "ma_nhan_vien") => ReactNode;
};

const relatedInfo = {
  "order-lines": { icon: Package, description: "Sản phẩm và số lượng trong đơn" },
  invoices: { icon: ReceiptText, description: "Hóa đơn và tổng tiền của đơn" },
  payments: { icon: CreditCard, description: "Lịch sử giao dịch thanh toán" },
  "voucher-uses": { icon: TicketPercent, description: "Mã giảm giá đã áp dụng" },
};
const groupedFields = new Set([
  "ma_donhang", "ma_kh", "ma_nhan_vien", "kenh_ban", "trang_thai", "thoi_gian_dat",
  "thoi_gian_xuat_kho", "thoi_gian_hoan_thanh", "ten_nguoi_nhan", "sdt_nguoi_nhan",
  "dia_chi_chi_tiet", "tinh_thanh", "xa_phuong", "ghi_chu",
]);
const fieldLabels: Record<string, string> = {
  ten_nguoi_nhan: "Người nhận", sdt_nguoi_nhan: "Số điện thoại", dia_chi_chi_tiet: "Địa chỉ giao hàng",
  tinh_thanh: "Tỉnh / thành phố", xa_phuong: "Phường / xã", ghi_chu: "Ghi chú đơn hàng",
};

export function OrderDetail({ row, columns, related, label, personName }: Props) {
  const status = String(row.trang_thai ?? "");
  const complete = status === "HOAN_THANH";
  const cancelled = status === "HUY";
  const StatusIcon = complete ? CheckCircle2 : cancelled ? XCircle : Clock3;
  const ChannelIcon = row.kenh_ban === "TAI_QUAY" ? Store : Globe2;
  const extraColumns = columns.filter(column => !groupedFields.has(column.name));
  const field = (name: string, wide = false) => <div key={name} className={`live-field ${styles.field} ${wide ? styles.wide : ""}`}>
    <dt>{fieldLabels[name] ?? label(name)}</dt>
    <dd>{orderValue(row, name)}</dd>
  </div>;

  return <div className={`order-detail ${styles.detail}`}>
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <span className={styles.orderIcon}><ShoppingBag size={25} aria-hidden="true" /></span>
        <div className={`live-field ${styles.title}`}>
          <p>Chi tiết đơn hàng</p>
          <h1>{orderValue(row, "ma_donhang")}</h1>
        </div>
      </div>
      <div className={styles.badges}>
        <span className={styles.channel}><ChannelIcon size={16} aria-hidden="true" />{orderValue(row, "kenh_ban")}</span>
        <span className={`${styles.status} ${complete ? styles.success : cancelled ? styles.cancelled : styles.pending}`}>
          <StatusIcon size={17} aria-hidden="true" />{orderValue(row, "trang_thai")}
        </span>
      </div>
    </header>

    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="order-delivery-title">
        <h2 id="order-delivery-title" className={styles.cardTitle}><MapPin size={20} aria-hidden="true" />Khách hàng & giao nhận</h2>
        <div className={`live-field ${styles.person}`}>
          <span className={styles.avatar}><UserRound size={22} aria-hidden="true" /></span>
          <div className={styles.personText}>
            <span className={styles.caption}>Khách hàng</span>
            <div className={styles.personName}>{personName(row, "ma_kh")}</div>
            {row.ma_kh && <span className={styles.identifier}>Mã khách hàng: {String(row.ma_kh)}</span>}
          </div>
        </div>
        <dl className={styles.fields}>
          {field("ten_nguoi_nhan")}{field("sdt_nguoi_nhan")}
          {field("dia_chi_chi_tiet", true)}{field("tinh_thanh")}{field("xa_phuong")}
        </dl>
        <div className={`live-field ${styles.note}`}>
          <h3><FileText size={17} aria-hidden="true" />Ghi chú đơn hàng</h3>
          <p>{row.ghi_chu ? String(row.ghi_chu) : "Chưa có ghi chú cho đơn hàng này."}</p>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="order-processing-title">
        <h2 id="order-processing-title" className={styles.cardTitle}><Package size={20} aria-hidden="true" />Thông tin xử lý</h2>
        <div className={`live-field ${styles.person}`}>
          <span className={`${styles.avatar} ${styles.staffAvatar}`}><UserRound size={22} aria-hidden="true" /></span>
          <div className={styles.personText}>
            <span className={styles.caption}>Nhân viên phụ trách</span>
            <div className={styles.personName}>{personName(row, "ma_nhan_vien")}</div>
            {row.ma_nhan_vien && <span className={styles.identifier}>Mã nhân viên: {String(row.ma_nhan_vien)}</span>}
          </div>
        </div>
        <dl className={styles.dates}>
          {["thoi_gian_dat", "thoi_gian_xuat_kho", "thoi_gian_hoan_thanh"].map(name => <div key={name} className={`live-field ${styles.date}`}>
            <dt><Clock3 size={16} aria-hidden="true" />{label(name)}</dt>
            <dd>{orderValue(row, name)}</dd>
          </div>)}
        </dl>
      </section>
    </div>

    {extraColumns.length > 0 && <section className={styles.card} aria-labelledby="order-additional-title">
      <h2 id="order-additional-title" className={styles.cardTitle}><FileText size={20} aria-hidden="true" />Thông tin bổ sung</h2>
      <dl className={styles.fields}>{extraColumns.map(column => field(column.name))}</dl>
    </section>}

    {related.length > 0 && <section className={styles.relatedSection} aria-labelledby="order-related-title">
      <div className={styles.relatedHeading}>
        <h2 id="order-related-title">Hồ sơ liên quan</h2>
        <p>Sản phẩm, hóa đơn và các giao dịch của đơn hàng</p>
      </div>
      <nav className={styles.related} aria-label="Thông tin đơn hàng">
        {related.map(item => {
          const info = relatedInfo[item.name as keyof typeof relatedInfo];
          if (!info) return null;
          const Icon = info.icon;
          return <Link key={item.name} className={styles.relatedLink} aria-label={item.title}
            href={dataHref(item.name, { orderId: String(row.ma_donhang) })}>
            <span className={styles.relatedIcon}><Icon size={21} aria-hidden="true" /></span>
            <div><strong>{item.title}</strong><span>{info.description}</span></div>
            <ArrowUpRight className={styles.linkArrow} size={18} aria-hidden="true" />
          </Link>;
        })}
      </nav>
    </section>}
  </div>;
}

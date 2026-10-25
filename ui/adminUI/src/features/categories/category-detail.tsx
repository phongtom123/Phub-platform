import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FolderTree, Info, Layers3, Package, PauseCircle, EyeOff } from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import { inlineStatusLabels, type DataColumn, type DataRow } from "../../lib/inline-table-data";
import styles from "./category-detail.module.css";

type Props = {
  row: DataRow; columns: DataColumn[]; label: (name: string) => string;
  related: { name: string; title: string }[];
};
const links = {
  subcategories: { icon: FolderTree, description: "Quản lý danh sách loại sản phẩm con" },
  products: { icon: Package, description: "Mở danh sách sản phẩm trong hệ thống" },
};

export function CategoryDetail({ row, columns, label, related }: Props) {
  const status = typeof row.trang_thai === "number" ? row.trang_thai : null;
  const statusLabel = status === null ? "Chưa xác định" : inlineStatusLabels[status] ?? "Chưa xác định";
  const StatusIcon = status === 1 ? CheckCircle2 : status === 2 ? PauseCircle : EyeOff;

  return <div className={`category-detail ${styles.detail}`}>
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <span className={styles.icon}><Layers3 size={27} aria-hidden="true" /></span>
        <div className={styles.title}><p>Chi tiết loại sản phẩm</p><h1>{String(row.ten_loai_sp ?? "Loại sản phẩm")}</h1></div>
      </div>
      <span className={`${styles.badge} ${status === 1 ? styles.active : status === 2 ? styles.paused : styles.hidden}`}>
        <StatusIcon size={17} aria-hidden="true" />{statusLabel}
      </span>
    </header>

    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="category-info-title">
        <h2 id="category-info-title"><Info size={20} aria-hidden="true" />Thông tin loại sản phẩm</h2>
        <dl className={styles.fields}>{columns.map(column => <div className={`live-field ${styles.field} ${column.name === "ten_loai_sp" ? styles.wide : ""}`} key={column.name}>
          <dt>{label(column.name)}</dt><dd>{column.name === "trang_thai" ? statusLabel : String(row[column.name] ?? "—")}</dd>
        </div>)}</dl>
      </section>

      {related.length > 0 && <section className={styles.relatedSection} aria-labelledby="category-related-title">
        <h2 id="category-related-title">Quản lý liên quan</h2>
        <p>Truy cập nhanh các danh sách quản lý</p>
        <nav className={styles.related} aria-label="Bảng liên quan">
          {related.map(item => {
            const info = links[item.name as keyof typeof links];
            if (!info) return null;
            const Icon = info.icon;
            return <Link className={styles.link} key={item.name} href={dataHref(item.name)} aria-label={item.title}>
              <span className={styles.linkIcon}><Icon size={23} aria-hidden="true" /></span>
              <div><strong>{item.title}</strong><span>{info.description}</span></div>
              <ArrowUpRight size={19} aria-hidden="true" />
            </Link>;
          })}
        </nav>
      </section>}
    </div>
  </div>;
}

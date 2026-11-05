import type { ReactNode } from "react";
import { Button } from "@/components/common/Button";
import type { Pagination } from "@/lib/account/client";
import styles from "./profile.module.css";

export function DataState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (loading) return <p className={styles.note} role="status">Đang tải dữ liệu…</p>;
  if (error) return <div className={styles.error} role="alert"><p>{error}</p><Button className={styles.secondaryButton} variant="outline" onClick={reload}>Thử lại</Button></div>;
  return null;
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className={styles.panel} aria-label={title}>
    <div className={styles.panelHeading}><h2>{title}</h2>{action}</div>
    {children}
  </section>;
}

export function Pager({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  if (pagination.total_pages <= 1) return null;
  return <nav className={styles.pager} aria-label="Phân trang đơn hàng">
    <Button className={styles.secondaryButton} variant="outline" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Trang trước</Button>
    <span>Trang {pagination.page} / {pagination.total_pages}</span>
    <Button className={styles.secondaryButton} variant="outline" disabled={pagination.page >= pagination.total_pages} onClick={() => onPage(pagination.page + 1)}>Trang sau</Button>
  </nav>;
}

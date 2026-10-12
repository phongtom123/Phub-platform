import { Button } from "@/components/common/Button";
import styles from "./Catalog.module.css";

export function CatalogStatus({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  if (loading) return <div className={styles.noResults} role="status" aria-live="polite">Đang tải sản phẩm…</div>;
  if (error) return <div className={styles.noResults} role="alert"><p>{error}</p><Button onClick={retry}>Thử lại</Button></div>;
  return null;
}

import styles from "./product-insights.module.css";
import { formatNumber } from "./product-insights-data";

export function StockBadge({ available, threshold }: { available: number; threshold: number }) {
  if (available === 0) return <span className={`${styles.stockBadge} ${styles.stockOut}`}>Hết hàng</span>;
  if (available <= threshold) return <span className={`${styles.stockBadge} ${styles.stockLow}`}>Sắp hết · {formatNumber(available)}</span>;
  return <span className={`${styles.stockBadge} ${styles.stockOk}`}>{formatNumber(available)}</span>;
}

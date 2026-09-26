import styles from "./store.module.css";

export interface PriceProps {
  amount: number;
  originalAmount?: number;
  currency?: string;
  locale?: string;
  className?: string;
}

export function Price({ amount, originalAmount, currency = "USD", locale = "en-US", className }: PriceProps) {
  const format = new Intl.NumberFormat(locale, { style: "currency", currency });
  return (
    <div className={[styles.price, className].filter(Boolean).join(" ")}>
      {originalAmount !== undefined && <del><span className={styles.srOnly}>Original price: </span>{format.format(originalAmount)}</del>}
      <strong><span className={styles.srOnly}>Current price: </span>{format.format(amount)}</strong>
    </div>
  );
}

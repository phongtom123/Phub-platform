import styles from "./store.module.css";

export interface PriceProps {
  amount: number;
  originalAmount?: number;
  currency?: string;
  locale?: string;
  className?: string;
  uiLocale?: "en" | "vi";
  showTaxNotice?: boolean;
}

export function TaxNotice() {
  return <small className={styles.taxNotice}>chưa áp dụng thuế 10%</small>;
}

export function Price({ amount, originalAmount, currency = "USD", locale = "en-US", className, uiLocale = "en", showTaxNotice = true }: PriceProps) {
  const format = new Intl.NumberFormat(locale, { style: "currency", currency });
  return (
    <div className={[styles.price, className].filter(Boolean).join(" ")}>
      {originalAmount !== undefined && <del><span className={styles.srOnly}>{uiLocale === "vi" ? "Giá gốc: " : "Original price: "}</span>{format.format(originalAmount)}</del>}
      <strong><span className={styles.srOnly}>{uiLocale === "vi" ? "Giá bán: " : "Current price: "}</span>{format.format(amount)}</strong>
      {showTaxNotice && <TaxNotice />}
    </div>
  );
}

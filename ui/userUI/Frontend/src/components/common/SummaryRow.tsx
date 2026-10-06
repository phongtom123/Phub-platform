import type { ReactNode } from "react";
import styles from "./store.module.css";

export interface SummaryRowProps {
  label: string;
  value: ReactNode;
  description?: string;
  total?: boolean;
}

/** Place inside a dl; no tax/shipping rules are hardcoded into this display component. */
export function SummaryRow({ label, value, description, total = false }: SummaryRowProps) {
  return (
    <div className={[styles.summaryRow, total && styles.summaryTotal].filter(Boolean).join(" ")}>
      <dt>{label}{description && <small>{description}</small>}</dt>
      <dd>{value}</dd>
    </div>
  );
}

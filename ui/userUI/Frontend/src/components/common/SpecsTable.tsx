import type { ReactNode } from "react";
import styles from "./store.module.css";

export interface SpecsTableProps {
  rows: { label: string; value: ReactNode }[];
  caption?: string;
  className?: string;
}

export function SpecsTable({ rows, caption = "Product specifications", className }: SpecsTableProps) {
  return (
    <table className={[styles.specs, className].filter(Boolean).join(" ")}>
      <caption className={styles.srOnly}>{caption}</caption>
      <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody>
    </table>
  );
}

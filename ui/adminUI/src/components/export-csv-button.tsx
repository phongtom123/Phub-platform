"use client";

import { Download } from "lucide-react";
import styles from "./export-csv-button.module.css";

export function ExportCsvButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button type="button" className={styles.button} onClick={onClick} disabled={disabled} aria-label="Xuất báo cáo CSV">
    <Download size={17} strokeWidth={2} aria-hidden="true" />
    <span>Xuất báo cáo</span>
    <span className={styles.format} aria-hidden="true">CSV</span>
  </button>;
}

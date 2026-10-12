import type { InputHTMLAttributes } from "react";
import styles from "./common.module.css";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  count?: number;
}

export function Checkbox({ count, label, className, ...props }: CheckboxProps) {
  return (
    <label className={[styles.checkbox, className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      {count !== undefined && <span className={styles.checkboxCount}>{count}</span>}
      <input {...props} type="checkbox" />
      <span className={styles.checkboxMark} aria-hidden="true" />
    </label>
  );
}
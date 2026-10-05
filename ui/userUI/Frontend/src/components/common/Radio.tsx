import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./store.module.css";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Radio({ label, className, ...props }: RadioProps) {
  return (
    <label className={[styles.radio, className].filter(Boolean).join(" ")}>
      <input {...props} type="radio" />
      <span className={styles.radioMark} aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

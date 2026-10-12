"use client";

import { useId, type SelectHTMLAttributes } from "react";
import styles from "./store.module.css";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string; disabled?: boolean }[];
  error?: string;
}

export function SelectField({ label, options, error, id, required, className, "aria-describedby": describedBy, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={fieldId}>{label}{required && <span className={styles.required} aria-hidden="true"> *</span>}</label>
      <div className={styles.selectControl}><select {...props} id={fieldId} required={required} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[describedBy, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined}>
        {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select></div>
      {error && <p id={`${fieldId}-error`} className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

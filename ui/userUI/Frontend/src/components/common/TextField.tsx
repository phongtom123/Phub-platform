"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./store.module.css";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  variant?: "default" | "dark";
  hideLabel?: boolean;
}

export function TextField({ label, hint, error, id, required, className, variant = "default", hideLabel = false, "aria-describedby": describedBy, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;
  return (
    <div className={[styles.field, variant === "dark" && styles.fieldDark, className].filter(Boolean).join(" ")}>
      <label className={hideLabel ? styles.srOnly : undefined} htmlFor={fieldId}>{label}{required && <span className={styles.required} aria-hidden="true"> *</span>}</label>
      <input {...props} id={fieldId} required={required} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[describedBy, (error || hint) && descriptionId].filter(Boolean).join(" ") || undefined} />
      {(error || hint) && <p id={descriptionId} className={error ? styles.error : styles.hint} role={error ? "alert" : undefined}>{error || hint}</p>}
    </div>
  );
}

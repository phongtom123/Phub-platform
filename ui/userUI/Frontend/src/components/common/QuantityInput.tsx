"use client";

import Image from "next/image";
import { useState, type InputHTMLAttributes } from "react";
import styles from "./store.module.css";

export interface QuantityInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"> {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onValueChange?: (value: number) => void;
  label?: string;
}

export function QuantityInput({ value, defaultValue = 1, min = 1, max = 99, onValueChange, label = "Quantity", disabled, readOnly, className, onBlur, ...props }: QuantityInputProps) {
  const upper = Math.max(min, max);
  const clamp = (next: number) => Math.max(min, Math.min(upper, Math.round(Number.isFinite(next) ? next : min)));
  const [internalValue, setInternalValue] = useState(clamp(defaultValue));
  const [draft, setDraft] = useState<string | null>(null);
  const current = clamp(value ?? internalValue);
  const update = (next: number) => {
    const result = clamp(next);
    if (value === undefined) setInternalValue(result);
    if (result !== current) onValueChange?.(result);
  };
  return (
    <div className={[styles.quantity, className].filter(Boolean).join(" ")}>
      <input {...props} type="number" aria-label={label} value={draft ?? current} min={min} max={upper} step={1} disabled={disabled} readOnly={readOnly}
        onChange={event => { const next = event.target.value; setDraft(next); if (next !== "" && Number.isInteger(Number(next)) && Number(next) >= min && Number(next) <= upper) update(Number(next)); }}
        onBlur={event => { if (draft !== null) update(Number(draft)); setDraft(null); onBlur?.(event); }} />
      <span className={styles.quantityActions}>
        <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || readOnly || current >= upper} onClick={() => { setDraft(null); update(current + 1); }}><Image src="/icons/tech-store/quantity-up.svg" alt="" width={16} height={16} /></button>
        <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || readOnly || current <= min} onClick={() => { setDraft(null); update(current - 1); }}><Image src="/icons/tech-store/quantity-down.svg" alt="" width={16} height={16} /></button>
      </span>
    </div>
  );
}

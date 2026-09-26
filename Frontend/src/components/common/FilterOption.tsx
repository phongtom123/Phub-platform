import type { ButtonHTMLAttributes } from "react";
import styles from "./store.module.css";

export interface FilterOptionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  count?: number;
  selected?: boolean;
}

/** Catalog filter rows: selectable label + count, without a visible checkbox. */
export function FilterOption({ label, count, selected = false, className, type = "button", ...props }: FilterOptionProps) {
  return (
    <button {...props} type={type} aria-pressed={selected} className={[styles.filterOption, className].filter(Boolean).join(" ")}>
      <span>{label}</span>{count !== undefined && <span>{count}</span>}
    </button>
  );
}

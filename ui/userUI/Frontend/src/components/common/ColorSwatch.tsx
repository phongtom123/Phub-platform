import type { CSSProperties, InputHTMLAttributes } from "react";
import styles from "./store.module.css";

export interface ColorSwatchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "color"> {
  color: string;
  label: string;
}

/** Give related swatches the same name to form a keyboard-accessible radio group. */
export function ColorSwatch({ color, label, className, ...props }: ColorSwatchProps) {
  return (
    <label className={[styles.swatch, className].filter(Boolean).join(" ")} title={label}>
      <input {...props} type="radio" aria-label={label} />
      <span aria-hidden="true" style={{ "--swatch-color": color } as CSSProperties} />
    </label>
  );
}

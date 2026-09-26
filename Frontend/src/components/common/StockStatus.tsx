import Image from "next/image";
import styles from "./store.module.css";

export interface StockStatusProps {
  status: "in-stock" | "check-availability";
  label?: string;
  className?: string;
}

export function StockStatus({ status, label, className }: StockStatusProps) {
  const available = status === "in-stock";
  return (
    <span className={[styles.stock, !available && styles.unavailable, className].filter(Boolean).join(" ")}>
      <Image src={`/icons/tech-store/${available ? "in-stock" : "availability"}.svg`} alt="" width={10} height={10} />
      {label ?? (available ? "in stock" : "check availability")}
    </span>
  );
}

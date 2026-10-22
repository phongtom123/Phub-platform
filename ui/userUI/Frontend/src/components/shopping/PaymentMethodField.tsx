"use client";
import type { PaymentMethod } from "@/lib/shopping/types";
import styles from "./shopping.module.css";

export const paymentMethods: Record<PaymentMethod, string> = {
  cash: "Tiền mặt", bank_transfer: "Chuyển khoản", card: "Thẻ", e_wallet: "Ví điện tử",
};
export function PaymentMethodField({ value, onChange, disabled = false }: {
  value: PaymentMethod; onChange: (method: PaymentMethod) => void; disabled?: boolean;
}) {
  return <label className={styles.form}>Phương thức thanh toán
    <select value={value} disabled={disabled} onChange={event => onChange(event.target.value as PaymentMethod)}>
      {Object.entries(paymentMethods).map(([method, label]) => <option key={method} value={method}>{label}</option>)}
    </select>
  </label>;
}

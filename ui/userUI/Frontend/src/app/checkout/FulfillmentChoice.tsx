import type { FulfillmentMethod } from "@/lib/shopping/types";
import styles from "./checkout.module.css";

export function FulfillmentChoice({ value, onChange, disabled }: {
  value: FulfillmentMethod; onChange: (value: FulfillmentMethod) => void; disabled?: boolean;
}) {
  return <fieldset className={styles.fulfillment} disabled={disabled}>
    <legend>Phương thức nhận hàng</legend>
    {([['GIAO_HANG', 'Giao hàng tận nơi'], ['TAI_CUA_HANG', 'Nhận tại cửa hàng']] as const).map(([method, label]) =>
      <label key={method} data-selected={value === method}>
        <input type="radio" name="fulfillment_method" checked={value === method} onChange={() => onChange(method)} />
        <span>{label}</span>
      </label>)}
  </fieldset>;
}

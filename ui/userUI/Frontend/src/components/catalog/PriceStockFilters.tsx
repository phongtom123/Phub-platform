import { useId } from "react";
import type { CatalogFilters } from "./catalogData";
import { priceFilterError } from "@/lib/catalog/filters";
import styles from "./SearchFilters.module.css";

export function PriceStockFilters({ value, onChange, section = "all" }: { value: CatalogFilters; onChange: (next: CatalogFilters) => void; section?: "all" | "price" | "stock" }) {
  const id = useId();
  const error = priceFilterError(value);
  return <>
    {section !== "stock" && <fieldset className={styles.priceGroup}>
      <legend>Khoảng giá (đ)</legend>
      <div className={styles.priceInputs}>
        <label>Giá từ<input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={value.minPrice ?? ""} aria-invalid={!!error} aria-describedby={error ? id : undefined} onChange={event => onChange({ ...value, minPrice: event.target.value })} /></label>
        <span aria-hidden="true">–</span>
        <label>Giá đến<input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Không giới hạn" value={value.maxPrice ?? ""} aria-invalid={!!error} aria-describedby={error ? id : undefined} onChange={event => onChange({ ...value, maxPrice: event.target.value })} /></label>
      </div>
      <small>Giá sản phẩm trước thuế.</small>
      {error && <p id={id} className={styles.error} role="alert">{error}</p>}
    </fieldset>}
    {section !== "price" && <label className={styles.field}>Tình trạng hàng
      <select value={value.stockStatus || (value.inStock ? "in-stock" : "")} onChange={event => onChange({ ...value, inStock: false, stockStatus: event.target.value as CatalogFilters["stockStatus"] })}>
        <option value="">Tất cả tình trạng</option><option value="in-stock">Còn hàng</option><option value="out-of-stock">Hết hàng</option>
      </select>
    </label>}
  </>;
}

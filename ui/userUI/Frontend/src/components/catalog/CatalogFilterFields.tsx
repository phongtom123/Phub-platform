import { FilterOption } from "@/components/common/FilterOption";
import type { CatalogFilters } from "./catalogData";
import type { CatalogMetadata } from "@/lib/catalog/types";
import styles from "./CatalogFilterFields.module.css";

export function CatalogFilterFields({ section, draft, onChange, colors }: {
  section: "price" | "color" | "stock"; draft: CatalogFilters;
  onChange: (value: CatalogFilters) => void; colors: CatalogMetadata["colors"];
}) {
  if (section === "price") return <div className={styles.price}>
    <label>Giá từ (₫)<input type="number" min="0" step="0.01" placeholder="Không giới hạn" value={draft.minPrice} onChange={e => onChange({ ...draft, minPrice: e.target.value })}/></label>
    <label>Giá đến (₫)<input type="number" min="0" step="0.01" placeholder="Không giới hạn" value={draft.maxPrice} onChange={e => onChange({ ...draft, maxPrice: e.target.value })}/></label>
    {draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice) && <p role="alert">Giá từ phải nhỏ hơn hoặc bằng giá đến.</p>}
  </div>;
  if (section === "color") return <div>
    <FilterOption label="Tất cả màu sắc" selected={!draft.color} onClick={() => onChange({ ...draft, color: "" })}/>
    {colors.map(color => <FilterOption key={color.value} label={color.label} selected={draft.color === color.value} onClick={() => onChange({ ...draft, color: draft.color === color.value ? "" : color.value })}/>) }
    {!colors.length && <p>Chưa có thông tin màu sắc trong sản phẩm.</p>}
  </div>;
  return <div>{[
    { value: "", label: "Tất cả trạng thái" }, { value: "in-stock", label: "Còn hàng" }, { value: "out-of-stock", label: "Hết hàng" },
  ].map(option => <FilterOption key={option.value} label={option.label} selected={draft.stockStatus === option.value} onClick={() => onChange({ ...draft, stockStatus: option.value as CatalogFilters["stockStatus"] })}/>)}</div>;
}

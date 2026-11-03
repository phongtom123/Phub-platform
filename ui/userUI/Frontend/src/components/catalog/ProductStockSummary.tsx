import type { ProductStock } from "@/lib/catalog/useProductStock";
import styles from "./ProductStockSummary.module.css";

export function ProductStockSummary({ stock, unit }: { stock: ProductStock; unit?: string }) {
  return <p className={styles.summary} data-state={stock.status} aria-live="polite">
    {stock.status === "checking" ? "Đang tải tồn kho…"
      : stock.status === "inactive" ? "Sản phẩm đang tạm ngừng bán"
      : stock.status === "error" || stock.availableQuantity === undefined
        ? <>Chưa tải được tồn kho. <button type="button" onClick={stock.reload}>Thử lại</button></>
        : <>Còn: <strong>{stock.availableQuantity.toLocaleString("vi-VN")}</strong> {unit?.toLocaleLowerCase("vi") || "sản phẩm"}{stock.status === "sold_out" ? " · Hết hàng" : ""}</>}
  </p>;
}

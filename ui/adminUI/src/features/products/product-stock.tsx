"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, RefreshCw, Warehouse } from "lucide-react";
import { sameAdminData } from "../../lib/admin-fetch";
import { dataHref } from "../../lib/data-navigation";
import { useAdminPolling } from "../../lib/use-admin-polling";
import { ScrollableTable } from "../tables/scrollable-table";
import { readProductStock, type ProductStockData } from "./product-stock-data";
import styles from "./product-stock.module.css";

export function ProductStock({ sku, unit }: { sku: string; unit: string }) {
  const [data, setData] = useState<ProductStockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    readProductStock(sku, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được tồn kho."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sku, version]);

  const pollError = useAdminPolling(`product-stock:${sku}:${version}`, Boolean(data) && !loading && !error, async (signal, canApply) => {
    const value = await readProductStock(sku, signal);
    if (canApply()) setData(current => sameAdminData(current, value) ? current : value);
  });

  return <section className={styles.card} aria-label="Tồn kho sản phẩm" aria-busy={loading}>
    <header className={styles.header}>
      <div><h2><Warehouse size={21} aria-hidden="true" />Tồn kho sản phẩm</h2><p>Tổng tồn theo SKU tại các kho</p></div>
      <button type="button" disabled={loading} onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Làm mới tồn kho</button>
    </header>
    {loading ? <p role="status">Đang tải số lượng tồn kho…</p> : error ? <p className="live-error" role="alert">{error} <button type="button" onClick={() => setVersion(value => value + 1)}>Thử lại</button></p> : data && <>
      {pollError && <p className="live-error" role="alert">Chưa cập nhật được tồn kho; đang hiển thị lần tải trước. {pollError}</p>}
      <div className={styles.total}><span className={styles.icon}><Package size={24} aria-hidden="true" /></span><div>
        <span className={styles.caption}>Số lượng tồn kho</span><p><strong>{data.total.toLocaleString("vi-VN")}</strong> <span>{unit}</span></p>
      </div></div>
      {data.rows.length ? <ScrollableTable><table><thead><tr><th>Kho</th><th>Số lượng tồn</th><th>Thao tác</th></tr></thead>
        <tbody>{data.rows.map(row => <tr key={row.warehouseId}>
          <td><Link href={dataHref("warehouses", { key: JSON.stringify([row.warehouseId]) })}>{row.warehouseName ?? `Kho ${row.warehouseId}`}</Link></td>
          <td>{row.quantity.toLocaleString("vi-VN")} {unit}</td>
          <td><Link href={dataHref("inventory", { key: JSON.stringify([row.warehouseId, sku]) })}>Chi tiết tồn kho</Link></td>
        </tr>)}</tbody></table></ScrollableTable> : <p className={styles.empty}>Chưa ghi nhận tồn kho cho SKU này.</p>}
      <p className={styles.note}>Số lượng thực tế trong kho, chưa trừ phần giữ cho đơn hàng.</p>
    </>}
  </section>;
}

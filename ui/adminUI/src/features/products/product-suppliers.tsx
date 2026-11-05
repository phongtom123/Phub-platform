"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Truck } from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import { ScrollableTable } from "../tables/scrollable-table";
import { readProductSuppliers, type ProductSupplier } from "./product-suppliers-data";
import styles from "./product-stock.module.css";

export function ProductSuppliers({ sku }: { sku: string }) {
  const [rows, setRows] = useState<ProductSupplier[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    readProductSuppliers(sku, controller.signal)
      .then(value => { if (!controller.signal.aborted) setRows(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được nhà cung cấp."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sku, version]);

  return <section className={styles.card} aria-label="Nhà cung cấp sản phẩm" aria-busy={loading}>
    <header className={styles.header}>
      <div><h2><Truck size={21} aria-hidden="true" />Nhà cung cấp</h2><p>Theo các phiếu nhập đã xác nhận của sản phẩm</p></div>
      <button type="button" disabled={loading} onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Làm mới nhà cung cấp</button>
    </header>
    {loading ? <p role="status">Đang tải nhà cung cấp…</p> : error ? <p className="live-error" role="alert">{error} <button type="button" onClick={() => setVersion(value => value + 1)}>Thử lại</button></p>
    : rows?.length ? <ScrollableTable><table><thead><tr><th>Nhà cung cấp</th><th>Số điện thoại</th><th>Email</th><th>Phiếu nhập đã xác nhận</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td><Link href={dataHref("suppliers", { key: JSON.stringify([row.id]) })}>{row.name}</Link></td>
        <td>{row.phone || "—"}</td><td>{row.email || "—"}</td><td>{row.receipts.toLocaleString("vi-VN")}</td>
      </tr>)}</tbody></table></ScrollableTable>
    : <p className={styles.empty}>Chưa ghi nhận nhà cung cấp từ phiếu nhập đã xác nhận.</p>}
  </section>;
}

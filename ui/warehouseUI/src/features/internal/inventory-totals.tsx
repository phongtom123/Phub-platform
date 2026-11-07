"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readAllRows } from "@internal/features/dashboard/dashboard-data";
import { dataHref } from "@internal/lib/data-navigation";

type Stock = { ma_kho: number; sku: string; so_luong_ton: number };
type Product = { ma_sp: string; sku: string; ten_sp: string; don_vi: string };

/** Preserve the staff SKU totals, using all pages rather than summing one page. */
export default function InventoryTotals() {
  const [data, setData] = useState<{ stock: Stock[]; products: Product[] } | null>(null);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([readAllRows<Stock>("inventory", controller.signal, Boolean(reload)), readAllRows<Product>("products", controller.signal, Boolean(reload))])
      .then(([stock, products]) => { if (!controller.signal.aborted) setData({ stock, products }); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const rows = useMemo(() => {
    if (!data) return [];
    const quantities = new Map<string, number>();
    for (const row of data.stock) quantities.set(row.sku, (quantities.get(row.sku) ?? 0) + row.so_luong_ton);
    const keyword = query.trim().toLocaleLowerCase("vi");
    return data.products.map(product => ({ ...product, quantity: quantities.get(product.sku) ?? 0 }))
      .filter(row => !keyword || `${row.sku} ${row.ten_sp}`.toLocaleLowerCase("vi").includes(keyword));
  }, [data, query]);
  return <section className="live-data">
    <div className="live-tools"><input className="live-search" aria-label="Tìm sản phẩm tồn kho" placeholder="Tìm tên sản phẩm hoặc SKU…" value={query} onChange={e => setQuery(e.target.value)} /><button type="button" onClick={() => setReload(value => value + 1)}>Làm mới</button><Link href="/history">Lịch sử kho</Link></div>
    <p className="live-note">Tổng tồn ghi nhận của từng sản phẩm trên tất cả kho. Tồn khả dụng khi bán hàng còn trừ số đang giữ cho đơn.</p>
    {error && <p className="live-error" role="alert">{error}</p>}
    {loading ? <p role="status">Đang tải tồn kho…</p> : !error && <><div className="live-table-wrap"><table className="live-table"><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Đơn vị</th><th>Tổng số lượng tồn</th><th>Trạng thái</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.ma_sp}><td>{row.sku}</td><td><Link href={dataHref("products", { key: JSON.stringify([row.ma_sp]) })}>{row.ten_sp}</Link></td><td>{row.don_vi}</td><td>{row.quantity.toLocaleString("vi-VN")}</td><td>{row.quantity === 0 ? "Hết hàng" : "Còn hàng"}</td><td><Link href={dataHref("inventory", { filters: { sku: row.sku } })}>Theo kho</Link></td></tr>)}</tbody></table></div>{!rows.length && <p>Không có sản phẩm phù hợp.</p>}<p>{rows.length} sản phẩm · Tất cả kho</p></>}
  </section>;
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { displayDate, warehouseApi } from "@/src/lib/warehouse-api";
import type { Page } from "@/src/features/receipts/types";

type StockEvent = { id: number; sku: string; product_name: string | null; before_quantity: number; after_quantity: number;
  actor: string | null; actor_name: string | null; reason: string; reference: string | null; created_at: string };
const reasons: Record<string, string> = { "receipts:confirm": "Nhập hàng", "inventory:adjust": "Điều chỉnh tồn", "orders:dispatch": "Xuất theo đơn hàng", "orders:cancel": "Hủy đơn hàng" };
export default function StockHistory() {
  const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [page, setPage] = useState(1); const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Page<StockEvent> | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) { setQuery(q); setSearch(q); } }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    const params = new URLSearchParams({ q: search, page: String(page), page_size: "20" });
    if (start) params.set("start", start); if (end) params.set("end", end);
    warehouseApi<Page<StockEvent>>(`warehouse/history?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(reason => { if (!controller.signal.aborted) { setResult(null); setError(reason.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, start, end, page, version]);
  return <section className="warehouse-workspace"><div className="page-heading"><div><h1>Lịch sử kho</h1><p>Biến động tồn thực tế tại kho được phân công. Thời gian hiển thị theo giờ Việt Nam.</p></div></div>
    <form className="warehouse-toolbar" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}>
      <input aria-label="Tìm lịch sử kho" placeholder="Tìm SKU, tên sản phẩm hoặc mã tham chiếu…" value={query} onChange={event => setQuery(event.target.value)} />
      <label>Từ ngày<input type="date" value={start} max={end || undefined} onChange={event => { setStart(event.target.value); setPage(1); }} /></label><label>Đến ngày<input type="date" value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); setPage(1); }} /></label>
      <button className="button">Tìm kiếm</button><button className="button" type="button" onClick={() => setVersion(v => v + 1)}>Làm mới</button>
    </form>{error && <p className="warehouse-error" role="alert">{error}</p>}
    <div className="warehouse-table" aria-busy={loading}><table><thead><tr><th>Sản phẩm / SKU</th><th>Trước</th><th>Thay đổi</th><th>Sau</th><th>Nghiệp vụ</th><th>Tham chiếu</th><th>Người thực hiện</th><th>Thời gian</th></tr></thead><tbody>
      {result?.data.map(event => { const change = event.after_quantity - event.before_quantity; return <tr key={event.id}><td><strong>{event.product_name ?? event.sku}</strong><small>{event.sku}</small></td><td>{event.before_quantity}</td><td className={change >= 0 ? "warehouse-positive" : "warehouse-negative"}>{change > 0 ? "+" : ""}{change}</td><td>{event.after_quantity}</td><td>{reasons[event.reason] ?? event.reason}</td><td>{event.reason === "receipts:confirm" && /^-?\d+$/.test(event.reference ?? "") ? <Link href={`/receipts/${event.reference}`}>Phiếu #{event.reference}</Link> : event.reference ?? "—"}</td><td>{event.actor_name ?? event.actor ?? "Hệ thống"}</td><td>{displayDate(event.created_at)}</td></tr>; })}
    </tbody></table>{loading ? <p role="status" className="warehouse-empty">Đang tải lịch sử…</p> : !error && !result?.data.length && <p className="warehouse-empty">Chưa có biến động tồn phù hợp. Lịch sử được ghi từ khi cơ chế theo dõi tồn được cài đặt.</p>}</div>
    <div className="warehouse-pagination"><span>{result?.total ?? 0} biến động · Trang {page}</span><button className="button" disabled={loading || page === 1} onClick={() => setPage(v => v - 1)}>Trước</button><button className="button" disabled={loading || !result || page * 20 >= result.total} onClick={() => setPage(v => v + 1)}>Sau</button></div>
  </section>;
}

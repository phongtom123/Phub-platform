"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { displayDate, receiptStatus, warehouseApi } from "@/src/lib/warehouse-api";
import { StatusBadge } from "@/src/components/warehouse/ui";
import type { Page, ReceiptListItem } from "./types";

export default function ReceiptList() {
  const [result, setResult] = useState<Page<ReceiptListItem> | null>(null);
  const [query, setQuery] = useState(""); const [search, setSearch] = useState("");
  const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), page_size: "20", q: search });
    if (status) params.set("status", status);
    warehouseApi<Page<ReceiptListItem>>(`warehouse/receipts?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(reason => { if (!controller.signal.aborted) { setResult(null); setError(reason.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, status, page, refresh]);
  return <section className="warehouse-workspace">
    <div className="page-heading"><div><h1>Phiếu nhập</h1><p>Lập phiếu, đối chiếu hàng và xác nhận nhập tại kho được phân công.</p></div></div>
    <form className="warehouse-toolbar" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}>
      <input aria-label="Tìm phiếu nhập" placeholder="Tìm mã phiếu hoặc nhà cung cấp…" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Trạng thái phiếu nhập" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(receiptStatus).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
      <button className="button">Tìm kiếm</button><button className="button" type="button" onClick={() => setRefresh(v => v + 1)}>Làm mới</button>
      <Link className="button primary" href="/receipts/new">+ Tạo phiếu nhập</Link>
    </form>
    {error && <p role="alert" className="warehouse-error">{error}</p>}
    <div className="warehouse-table" aria-busy={loading}><table><thead><tr><th>Mã phiếu</th><th>Nhà cung cấp</th><th>Số SKU</th><th>Người lập</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead>
      <tbody>{result?.data.map(row => <tr key={row.ma_phieu_nhap}><td><Link href={`/receipts/${row.ma_phieu_nhap}`}>{row.ma_phieu_code}</Link></td><td>{row.supplier_name}</td><td>{row.line_count}</td><td>{row.creator_name ?? row.nguoi_tao}</td><td><StatusBadge value={receiptStatus[row.trang_thai]} /></td><td>{displayDate(row.ngay_tao)}</td><td><Link href={`/receipts/${row.ma_phieu_nhap}`}>Chi tiết</Link></td></tr>)}</tbody></table>
      {loading ? <p role="status" className="warehouse-empty">Đang tải phiếu nhập…</p> : !error && !result?.data.length && <p className="warehouse-empty">Chưa có phiếu nhập phù hợp.</p>}
    </div>
    <div className="warehouse-pagination"><span>{result?.total ?? 0} phiếu · Trang {page}</span><button className="button" disabled={loading || page === 1} onClick={() => setPage(v => v - 1)}>Trước</button><button className="button" disabled={loading || !result || page * 20 >= result.total} onClick={() => setPage(v => v + 1)}>Sau</button></div>
  </section>;
}

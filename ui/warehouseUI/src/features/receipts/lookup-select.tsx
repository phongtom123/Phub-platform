"use client";
import { useEffect, useState } from "react";
import { warehouseApi } from "@/src/lib/warehouse-api";
import type { Page } from "./types";

export type LookupRow = Record<string, string | number | null>;
export default function LookupSelect({ resource, label, onSelect, disabled }: {
  resource: "suppliers" | "products"; label: string; onSelect: (row: LookupRow) => void; disabled?: boolean;
}) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<LookupRow> | null>(null); const [error, setError] = useState("");
  const [selected, setSelected] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setSelected("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, page: String(page), page_size: "20", filters: JSON.stringify({ trang_thai: 1 }) });
      warehouseApi<Page<LookupRow>>(`data/${resource}?${params}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setResult(data); })
        .catch(reason => { if (!controller.signal.aborted) { setResult(null); setError(reason.message); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, page, resource]);
  const key = resource === "products" ? "sku" : "ma_ncc";
  return <fieldset className="warehouse-lookup" disabled={disabled}><legend>{label}</legend>
    <input aria-label={`Tìm ${label.toLowerCase()}`} value={query} placeholder={`Tìm ${label.toLowerCase()}…`} onChange={event => { setQuery(event.target.value); setPage(1); }} />
    <div className="warehouse-toolbar"><select aria-label={label} value={selected} disabled={loading} onChange={event => setSelected(event.target.value)}><option value="">{loading ? "Đang tải…" : "Chọn kết quả"}</option>{result?.data.map(row => <option key={String(row[key])} value={String(row[key])}>{resource === "products" ? `${row.ten_sp} · ${row.sku}` : row.ten_ncc}</option>)}</select>
      <button className="button" type="button" disabled={!selected || loading} onClick={() => { const row = result?.data.find(item => String(item[key]) === selected); if (row) { onSelect(row); setSelected(""); } }}>Chọn</button>
      <button className="button" type="button" disabled={loading || page === 1} onClick={() => setPage(v => v - 1)}>Trước</button><span>Trang {page}</span><button className="button" type="button" disabled={loading || !result || page * 20 >= result.total} onClick={() => setPage(v => v + 1)}>Sau</button>
    </div>{error && <p role="alert" className="warehouse-error">{error}</p>}{!loading && !error && result?.total === 0 && <p>Không có kết quả phù hợp.</p>}
  </fieldset>;
}

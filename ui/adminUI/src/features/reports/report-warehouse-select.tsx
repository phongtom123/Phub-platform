"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/src/lib/admin-fetch";

type Warehouse = { ma_kho: number; ten_kho: string };

export function ReportWarehouseSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    (async () => {
      const rows: Warehouse[] = [];
      for (let page = 1; ; page++) {
        const response = await adminFetch(`/api/backend/data/warehouses?page=${page}&page_size=100`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 ||
          body.data.some((row: Warehouse) => !row || !Number.isSafeInteger(row.ma_kho) || row.ma_kho <= 0 || typeof row.ten_kho !== "string")) {
          throw new Error("Chưa tải được danh sách kho.");
        }
        rows.push(...body.data);
        if (rows.length >= body.total) break;
        if (!body.data.length || page >= 100) throw new Error("Danh sách kho chưa đầy đủ.");
      }
      if (new Set(rows.map(row => row.ma_kho)).size !== rows.length) throw new Error("Danh sách kho bị trùng.");
      if (!controller.signal.aborted) setWarehouses(rows);
    })().catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được kho."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);

  return <label><span>Kho báo cáo</span><select aria-label="Kho báo cáo" value={value} disabled={loading} onChange={event => onChange(event.target.value)}>
    <option value="">Tất cả kho</option>
    {value && !warehouses.some(row => String(row.ma_kho) === value) && <option value={value}>Kho {value}</option>}
    {warehouses.map(row => <option key={row.ma_kho} value={row.ma_kho}>{row.ten_kho} · #{row.ma_kho}</option>)}
  </select>{error && <small role="alert">{error} <button type="button" onClick={() => setVersion(value => value + 1)}>Tải lại kho</button></small>}</label>;
}

"use client";

import { useEffect, useState } from "react";
import BackendDataView from "@/src/components/backend-data-view";
import type { ModuleKey } from "@/src/types/admin";

const metrics: { label: string; resource: string; target: ModuleKey }[] = [
  { label: "Đơn hàng", resource: "orders", target: "orders" },
  { label: "Sản phẩm", resource: "products", target: "products" },
  { label: "Khách hàng", resource: "customers", target: "customers" },
  { label: "Bản ghi tồn kho", resource: "inventory", target: "inventory" },
];

export function DashboardView({ onNavigate }: { onNavigate: (key: ModuleKey) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const controller = new AbortController();
    metrics.forEach(metric => {
      fetch(`/api/backend/data/${metric.resource}?page_size=1`, { cache: "no-store", signal: controller.signal })
        .then(async response => { if (!response.ok) return; const body = await response.json(); setCounts(current => ({ ...current, [metric.resource]: body.total })); })
        .catch(() => {});
    });
    return () => controller.abort();
  }, []);
  return <><div className="metrics">{metrics.map(metric => <article className="metric" key={metric.resource}><button className="metric-link" aria-label={`Mở ${metric.label}`} onClick={() => onNavigate(metric.target)}>↗</button><span>{metric.label}</span><strong>{counts[metric.resource] ?? "—"}</strong><p>Tổng bản ghi trên Supabase</p></article>)}</div><BackendDataView resource="orders" /></>;
}

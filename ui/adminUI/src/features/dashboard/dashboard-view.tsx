"use client";

import BackendDataView from "@/src/components/backend-data-view";
import type { ModuleKey } from "@/src/types/admin";
import { useDashboardData } from "./use-dashboard-data";
import { DashboardCharts } from "./dashboard-charts";

const metrics: { label: string; resource: string; target: ModuleKey }[] = [
  { label: "Đơn hàng", resource: "orders", target: "orders" },
  { label: "Sản phẩm", resource: "products", target: "products" },
  { label: "Khách hàng", resource: "customers", target: "customers" },
  { label: "Bản ghi tồn kho", resource: "inventory", target: "inventory" },
];

export function DashboardView({ onNavigate }: { onNavigate: (key: ModuleKey) => void }) {
  const data = useDashboardData();
  return <>
    <div className="metrics">{metrics.map(metric => <article className="metric" key={metric.resource}>
      <button className="metric-link" aria-label={`Mở ${metric.label}`} onClick={() => onNavigate(metric.target)}>↗</button>
      <span>{metric.label}</span><strong>{data.counts[metric.resource]?.toLocaleString("vi-VN") ?? "—"}</strong>
      <p>{data.countErrors[metric.resource] ? "Không tải được dữ liệu" : "Tổng bản ghi trên Supabase"}</p>
    </article>)}</div>
    <DashboardCharts data={data} onNavigate={onNavigate} />
    <BackendDataView resource="orders" embedded />
  </>;
}

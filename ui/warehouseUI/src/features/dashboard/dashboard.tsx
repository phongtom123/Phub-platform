"use client";

import BackendDataView from "@warehouse/src/components/backend-data-view";
import { useEffect, useState } from "react";

type Summary = { sku_count: number; total_quantity: number; low_stock_count: number; pending_receipts: number; pending_transfers: number };

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/backend/warehouse/summary", { cache: "no-store" }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.detail ?? "Không tải được tổng quan kho."); setSummary(body); }).catch(err => setError(err instanceof Error ? err.message : "Không tải được tổng quan kho.")); }, []);
  const cards = summary ? [["SKU đang quản lý", summary.sku_count], ["Tổng số lượng tồn", summary.total_quantity], ["Tồn bằng 0", summary.low_stock_count], ["Phiếu nhập chờ xử lý", summary.pending_receipts], ["Chuyển kho đang xử lý", summary.pending_transfers]] : [];
  return <><div className="page-heading"><div><h1>Tổng quan kho</h1><p>Dữ liệu được giới hạn theo kho làm việc của tài khoản.</p></div></div>{error && <p className="live-error" role="alert">{error}</p>}<div className="warehouse-summary">{cards.map(([label, value]) => <article className="summary-card" key={String(label)}><span>{label}</span><strong>{Number(value).toLocaleString("vi-VN")}</strong></article>)}</div><div className="quick-actions"><a className="button" href="/receipts">Phiếu nhập</a><a className="button" href="/transfers">Chuyển kho</a><a className="button" href="/products">Sản phẩm</a></div><BackendDataView resource="inventory" /></>;
}

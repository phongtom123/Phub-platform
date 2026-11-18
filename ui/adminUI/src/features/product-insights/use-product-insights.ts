"use client";

import { useEffect, useState } from "react";
import { fetchProductInsights, type InsightsPeriod, type InsightsRange, type ProductInvoiceReport } from "./product-insights-data";

type LoadState = { key: string; loading: boolean; error: string | null; report: ProductInvoiceReport | null };

export function useProductInsights(period: InsightsPeriod, range: InsightsRange) {
  const [revision, setRevision] = useState(0);
  const key = `${period}:${range.start ?? ""}:${range.end ?? ""}:${revision}`;
  const [state, setState] = useState<LoadState>({ key, loading: true, error: null, report: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loading: true, error: null, report: null });
    void fetchProductInsights(period, { start: range.start, end: range.end }, controller.signal)
      .then(report => {
        if (!controller.signal.aborted) setState({ key, loading: false, error: null, report });
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ key, loading: false, error: error instanceof Error ? error.message : "Lỗi khi tải thống kê.", report: null });
      });
    return () => controller.abort();
  }, [key, period, range.start, range.end]);

  // Never show or export the previous snapshot after a filter change.
  const current = state.key === key ? state : { loading: true, error: null, report: null };
  return { ...current, refresh: () => setRevision(value => value + 1) };
}

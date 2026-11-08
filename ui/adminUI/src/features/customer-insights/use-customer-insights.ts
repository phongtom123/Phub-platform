"use client";

import { useEffect, useState } from "react";
import { fetchCustomerInsights, type CustomerInsightsReport, type InsightsScope } from "./customer-insights-data";

type LoadState = { key: string; loading: boolean; error: string | null; report: CustomerInsightsReport | null };

export function useCustomerInsights(period: "month" | "quarter" | "year", scope: InsightsScope) {
  const [revision, setRevision] = useState(0);
  const key = `${period}:${scope}:${revision}`;
  const [state, setState] = useState<LoadState>({ key, loading: true, error: null, report: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loading: true, error: null, report: null });
    void fetchCustomerInsights(period, controller.signal, undefined, undefined, scope)
      .then(report => {
        if (!controller.signal.aborted) setState({ key, loading: false, error: null, report });
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ key, loading: false, error: error instanceof Error ? error.message : "Lỗi khi tải dữ liệu phân tích.", report: null });
      });
    return () => controller.abort();
  }, [key, period, scope]);

  // Filters can commit before the effect cleanup. Never show/export the previous snapshot.
  const current = state.key === key ? state : { loading: true, error: null, report: null };
  return { ...current, refresh: () => setRevision(value => value + 1) };
}

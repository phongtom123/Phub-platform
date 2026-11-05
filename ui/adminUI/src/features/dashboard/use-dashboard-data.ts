"use client";
import { useCallback, useEffect, useState } from "react";
import { operationRead } from "../operations/api";
import { vietnamDay, type ChartValue } from "./dashboard-data";
import { useAdminPolling } from "../../lib/use-admin-polling";
export type Summary = {
  counts: Record<string, number>;
  orders: { day: string; value: number }[];
  statuses: { label: string; value: number }[];
  channels: { label: string; value: number }[];
  inventory: { label: string; value: number }[];
  revenue: string;
  collected: string;
  top_products: {
    sku: string;
    name: string;
    quantity: number;
    total: string;
  }[];
  start: string;
  end: string;
};
const colors = [
  "#14a800",
  "#2563eb",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
];
export const chartValues = (
  rows: { label: string; value: number }[],
): ChartValue[] =>
  rows.map((row, i) => ({ ...row, color: colors[i % colors.length] }));
export function useDashboardData() {
  const [days, setDays] = useState(30),
    [version, setVersion] = useState(0),
    [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const read = useCallback(
    async (signal: AbortSignal) => {
      const end = vietnamDay(new Date())!;
      const start = new Date(
        Date.parse(end + "T00:00:00Z") - (days - 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      const result = await operationRead<Summary>(
        "summary",
        { start, end },
        signal,
      );
      if (
        !result.counts ||
        !Array.isArray(result.orders) ||
        !Array.isArray(result.inventory) ||
        typeof result.revenue !== "string"
      )
        throw new Error("API thống kê trả dữ liệu không hợp lệ.");
      return result;
    },
    [days],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void read(controller.signal)
      .then(setSummary)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [read, version]);
  const pollError = useAdminPolling(
    `${days}:${version}`,
    !loading,
    async (signal, alive) => {
      const result = await read(signal);
      if (alive()) {
        setSummary(result);
        setError("");
      }
    },
  );
  return {
    summary,
    days,
    setDays,
    counts: summary?.counts ?? {},
    countErrors: error
      ? Object.fromEntries(
          ["orders", "products", "customers", "inventory"].map((k) => [
            k,
            error,
          ]),
        )
      : {},
    orders: { loading, data: summary?.orders ?? null, error },
    inventory: {
      loading,
      data: summary ? chartValues(summary.inventory) : null,
      error,
    },
    today: summary?.end ?? null,
    pollError,
    refresh: () => setVersion((v) => v + 1),
  };
}

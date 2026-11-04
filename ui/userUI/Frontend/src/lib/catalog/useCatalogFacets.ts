"use client";
import { useEffect, useState } from "react";
import { queryFor, readJson } from "./client";
import type { CatalogFacets, CatalogRequest, FacetOption } from "./types";

const cache = new Map<string, { data: CatalogFacets; at: number }>();
function validate(value: unknown): CatalogFacets {
  const data = value as CatalogFacets;
  const optionsValid = (options: FacetOption[]) => Array.isArray(options) && options.every(option => option && typeof option.value === "string" && typeof option.label === "string" && Number.isInteger(option.count) && option.count >= 0);
  if (!data || !Number.isInteger(data.total) || data.total < 0 || !optionsValid(data.brands) || !Array.isArray(data.specs)
      || !data.specs.every(facet => facet && typeof facet.key === "string" && typeof facet.label === "string" && optionsValid(facet.options))) throw new Error("Bộ lọc sản phẩm chưa hợp lệ. Vui lòng thử lại.");
  return data;
}
export function useCatalogFacets(request: CatalogRequest) {
  const query = queryFor(request);
  ["page", "page_size", "sort"].forEach(key => query.delete(key));
  const key = query.toString();
  const [attempt, setAttempt] = useState({ key: "", count: 0 });
  const [state, setState] = useState<{ key: string; data: CatalogFacets | null; error: string } | null>(null);
  useEffect(() => {
    const cached = cache.get(key);
    if (attempt.key !== key && cached && Date.now() - cached.at < 60_000) return;
    const controller = new AbortController();
    fetch(`/api/catalog/facets?${key}`, { signal: controller.signal, cache: "no-store" }).then(readJson).then(validate).then(data => {
      if (controller.signal.aborted) return;
      if (!cache.has(key) && cache.size >= 30) cache.delete(cache.keys().next().value!);
      cache.set(key, { data, at: Date.now() }); setState({ key, data, error: "" });
    }).catch(cause => {
      if (!controller.signal.aborted) setState({ key, data: null, error: cause instanceof Error ? cause.message : "Không tải được bộ lọc." });
    });
    return () => controller.abort();
  }, [key, attempt]);
  const current = state?.key === key ? state : null;
  const data = current ? current.data : cache.get(key)?.data ?? null;
  return { data, loading: !data && !current?.error, error: current?.error ?? "", retry: () => setAttempt(value => ({ key, count: value.count + 1 })) };
}

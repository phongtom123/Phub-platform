"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type CatalogFilters, type CatalogSort } from "@/components/catalog/catalogData";
import { catalogProduct, type CatalogMetadata, type CatalogPagination, type CatalogRequest } from "./types";
import { filtersFromParams, getMetadata, getProducts, queryFor } from "./client";

function subscribeMobile(callback: () => void) {
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
export function useMobile() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 760px)").matches, () => false);
}

export function useCatalogMetadata() {
  const [state, setState] = useState<{ data: CatalogMetadata; loading: boolean; error: string | null }>({
    data: { categories: [], brands: [], colors: [] }, loading: true, error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getMetadata(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ data: { categories: [], brands: [], colors: [] }, loading: false, error: error instanceof Error ? error.message : "Không thể tải bộ lọc." });
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, retry: () => { setState(current => ({ ...current, loading: true, error: null })); setAttempt(current => current + 1); } };
}

function integer(value: string | null, fallback: number, max: number) {
  return value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : fallback;
}

export function useCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const mobile = useMobile();
  const previousLayout = useRef<boolean | null>(null);
  useEffect(() => {
    const actualMobile = window.matchMedia("(max-width: 760px)").matches;
    if (previousLayout.current === null) {
      previousLayout.current = actualMobile;
      return;
    }
    if (previousLayout.current !== actualMobile) {
      previousLayout.current = actualMobile;
      const query = new URLSearchParams(window.location.search);
      query.set("page", "1");
      router.replace(`/main/product?${query}`, { scroll: false });
    }
  }, [mobile, router]);
  const view = params.get("view") === "list" && !mobile ? "list" : "grid";
  const sort: CatalogSort = params.get("sort") === "price-asc" ? "price-asc" : params.get("sort") === "price-desc" ? "price-desc" : "position";
  const filters = filtersFromParams(params);
  const request: CatalogRequest = {
    q: params.get("q") || "", filters, sort, view,
    page: integer(params.get("page"), 1, 2_147_483_647),
    pageSize: mobile ? 12 : integer(params.get("page_size"), view === "list" ? 4 : 20, 100),
  };
  const key = queryFor(request).toString();
  const [state, setState] = useState<{
    key: string; products: ReturnType<typeof catalogProduct>[]; pagination: CatalogPagination | null; error: string | null;
  }>({ key: "", products: [], pagination: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const metadata = useCatalogMetadata();
  useEffect(() => {
    const controller = new AbortController();
    // The query string is the stable dependency; ignore superseded responses.
    const query = new URLSearchParams(key);
    const snapshot: CatalogRequest = {
      q: query.get("q") || "", filters: filtersFromParams(query),
      sort: query.get("sort") === "default" ? "position" : query.get("sort") as CatalogSort,
      page: Number(query.get("page")), pageSize: Number(query.get("page_size")), view: "grid",
    };
    getProducts(snapshot, controller.signal).then(result => {
      if (!controller.signal.aborted) setState({ key, products: result.items.map(catalogProduct), pagination: result.pagination, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, products: [], pagination: null, error: error instanceof Error ? error.message : "Không thể tải sản phẩm." });
    });
    return () => controller.abort();
  }, [key, attempt]);

  const navigate = useCallback((next: CatalogRequest) => {
    const query = queryFor(next);
    if (query.get("sort") === "default") query.delete("sort");
    if (next.view === "list") query.set("view", "list");
    router.push(`/main/product?${query}`, { scroll: false });
  }, [router]);
  const current = state.key === key;
  return {
    request, mobile, metadata, key,
    products: current ? state.products : [],
    pagination: current ? state.pagination : null,
    loading: !current, error: current ? state.error : null,
    apply: (next: CatalogFilters) => navigate({ ...request, filters: next, page: 1 }),
    sortBy: (next: CatalogSort) => navigate({ ...request, sort: next, page: 1 }),
    turnPage: (page: number) => navigate({ ...request, page }),
    resize: (pageSize: number) => navigate({ ...request, pageSize, page: 1 }),
    changeView: (next: "grid" | "list") => navigate({ ...request, view: next, pageSize: next === "list" ? 4 : 20, page: 1 }),
    retry: () => { setState(current => ({ ...current, key: "" })); setAttempt(value => value + 1); },
  };
}

export type CatalogController = ReturnType<typeof useCatalog>;

export function useCatalogDraft(catalog: CatalogController) {
  const [state, setState] = useState({ key: catalog.key, filters: catalog.request.filters });
  const draft = state.key === catalog.key ? state.filters : catalog.request.filters;
  return [draft, (filters: CatalogFilters) => setState({ key: catalog.key, filters })] as const;
}

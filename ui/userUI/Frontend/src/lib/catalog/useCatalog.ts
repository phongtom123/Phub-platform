"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { emptyFilters, type CatalogFilters, type CatalogSort } from "@/components/catalog/catalogData";
import { catalogProduct, type CatalogMetadata, type CatalogPagination, type CatalogRequest } from "./types";
import { getMetadata, getProducts, queryFor } from "./client";

type CatalogItem = ReturnType<typeof catalogProduct>;
type CatalogPageData = { products: CatalogItem[]; pagination: CatalogPagination };

const MAX_CACHED_PAGES = 50;
const catalogPageCache = new Map<string, CatalogPageData>();
let metadataCache: CatalogMetadata | null = null;

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rememberPage(key: string, page: CatalogPageData) {
  if (!catalogPageCache.has(key) && catalogPageCache.size >= MAX_CACHED_PAGES) {
    const oldestKey = catalogPageCache.keys().next().value;
    if (oldestKey) catalogPageCache.delete(oldestKey);
  }
  catalogPageCache.set(key, page);
}

function reconcilePage(previous: CatalogPageData | undefined, products: CatalogItem[], pagination: CatalogPagination) {
  if (!previous) return { products, pagination };
  const previousById = new Map(previous.products.map(product => [product.id, product]));
  const reconciled = products.map(product => {
    const oldProduct = previousById.get(product.id);
    return oldProduct && sameValue(oldProduct, product) ? oldProduct : product;
  });
  const stableProducts = reconciled.length === previous.products.length
    && reconciled.every((product, index) => product === previous.products[index])
    ? previous.products : reconciled;
  const stablePagination = sameValue(previous.pagination, pagination) ? previous.pagination : pagination;
  return stableProducts === previous.products && stablePagination === previous.pagination
    ? previous : { products: stableProducts, pagination: stablePagination };
}

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
    data: metadataCache ?? { categories: [], brands: [] }, loading: metadataCache === null, error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getMetadata(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (metadataCache && sameValue(metadataCache, data)) {
        setState(current => current.data === metadataCache && !current.loading && !current.error
          ? current : { data: metadataCache!, loading: false, error: null });
        return;
      }
      metadataCache = data;
      setState({ data, loading: false, error: null });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (metadataCache) setState({ data: metadataCache, loading: false, error: null });
      else setState({ data: { categories: [], brands: [] }, loading: false, error: error instanceof Error ? error.message : "Không thể tải bộ lọc." });
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, retry: () => { setState(current => ({ ...current, loading: !metadataCache, error: null })); setAttempt(current => current + 1); } };
}

export type CatalogMetadataController = ReturnType<typeof useCatalogMetadata>;

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
  const filters: CatalogFilters = {
    ...emptyFilters, categories: params.getAll("category_id"),
    subcategories: params.getAll("subcategory_id"), brand: params.get("brand") || "",
  };
  const request: CatalogRequest = {
    q: params.get("q") || "", filters, sort, view,
    page: integer(params.get("page"), 1, 2_147_483_647),
    pageSize: mobile ? 12 : integer(params.get("page_size"), view === "list" ? 4 : 20, 100),
  };
  const key = queryFor(request).toString();
  const [state, setState] = useState<{
    key: string; page: CatalogPageData | null; error: string | null;
  }>(() => ({ key, page: catalogPageCache.get(key) ?? null, error: null }));
  const [attempt, setAttempt] = useState(0);
  const metadata = useCatalogMetadata();
  useEffect(() => {
    const controller = new AbortController();
    // The query string is the stable dependency; ignore superseded responses.
    const query = new URLSearchParams(key);
    const snapshot: CatalogRequest = {
      q: query.get("q") || "", filters: {
        ...emptyFilters, categories: query.getAll("category_id"),
        subcategories: query.getAll("subcategory_id"), brand: query.get("brand") || "",
      },
      sort: query.get("sort") === "default" ? "position" : query.get("sort") as CatalogSort,
      page: Number(query.get("page")), pageSize: Number(query.get("page_size")), view: "grid",
    };
    getProducts(snapshot, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const previous = catalogPageCache.get(key);
      const page = reconcilePage(previous, result.items.map(catalogProduct), result.pagination);
      if (page === previous) return;
      rememberPage(key, page);
      setState({ key, page, error: null });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const cached = catalogPageCache.get(key);
      if (cached) setState({ key, page: cached, error: null });
      else setState({ key, page: null, error: error instanceof Error ? error.message : "Không thể tải sản phẩm." });
    });
    return () => controller.abort();
  }, [key, attempt]);

  const navigate = useCallback((next: CatalogRequest) => {
    const query = queryFor(next);
    if (query.get("sort") === "default") query.delete("sort");
    if (next.view === "list") query.set("view", "list");
    router.push(`/main/product?${query}`, { scroll: false });
  }, [router]);
  const currentState = state.key === key ? state : null;
  const page = currentState?.page ?? catalogPageCache.get(key) ?? null;
  return {
    request, mobile, metadata, key,
    products: page?.products ?? [],
    pagination: page?.pagination ?? null,
    loading: !page && !currentState?.error, error: page ? null : currentState?.error ?? null,
    apply: (next: CatalogFilters) => navigate({ ...request, filters: next, page: 1 }),
    sortBy: (next: CatalogSort) => navigate({ ...request, sort: next, page: 1 }),
    turnPage: (page: number) => navigate({ ...request, page }),
    resize: (pageSize: number) => navigate({ ...request, pageSize, page: 1 }),
    changeView: (next: "grid" | "list") => navigate({ ...request, view: next, pageSize: next === "list" ? 4 : 20, page: 1 }),
    retry: () => { setState(current => ({ ...current, error: null })); setAttempt(value => value + 1); },
  };
}

export type CatalogController = ReturnType<typeof useCatalog>;

export function useCatalogDraft(catalog: CatalogController) {
  const [state, setState] = useState({ key: catalog.key, filters: catalog.request.filters });
  const draft = state.key === catalog.key ? state.filters : catalog.request.filters;
  return [draft, (filters: CatalogFilters) => setState({ key: catalog.key, filters })] as const;
}

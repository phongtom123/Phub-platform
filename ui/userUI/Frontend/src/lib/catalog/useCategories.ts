"use client";

import { useEffect, useState } from "react";
import { getCategories } from "./client";
import type { CatalogCategory } from "./types";

export function useCategories() {
  const [state, setState] = useState<{ data: CatalogCategory[]; loading: boolean; error: string | null }>({
    data: [], loading: true, error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ data: [], loading: false, error: error instanceof Error ? error.message : "Không thể tải danh mục." });
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, retry: () => { setState(current => ({ ...current, loading: true, error: null })); setAttempt(current => current + 1); } };
}

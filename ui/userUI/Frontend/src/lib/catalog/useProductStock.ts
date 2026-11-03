"use client";

import { useCallback, useEffect, useState } from "react";
import { automaticRefresh } from "@/lib/automaticRefresh";
import { getProductAvailability } from "./client";

type StockStatus = "checking" | "available" | "sold_out" | "error";
export interface ProductStock {
  status: StockStatus;
  reload: () => void;
}

export function useProductStock(product?: { id: string; sku?: string }, enabled = true): ProductStock {
  const id = product?.id, sku = product?.sku;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([id, sku, revision]);
  const [result, setResult] = useState<{ key: string; status: StockStatus } | null>(null);
  useEffect(() => {
    if (!enabled || !id) return;
    const controller = new AbortController();
    const stop = automaticRefresh(async () => {
      try {
        // One available unit determines whether the product is sold out. The
        // requested quantity is checked separately when adding or checking out.
        const available = await getProductAvailability({ id, sku }, 1, controller.signal);
        if (!controller.signal.aborted) setResult({ key, status: available ? "available" : "sold_out" });
      } catch {
        if (!controller.signal.aborted) setResult({ key, status: "error" });
      }
      return !controller.signal.aborted;
    }, 15000);
    return () => { controller.abort(); stop(); };
  }, [id, sku, key, enabled]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  return { status: result?.key === key ? result.status : "checking", reload };
}

"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { automaticRefresh } from "@/lib/automaticRefresh";
import { getProductPurchaseState } from "./client";
import { productStock, subscribeProductStock } from "./product-stock-store";
import type { StockStatus } from "./stock-batch";

export interface ProductStock {
  status: StockStatus;
  availableQuantity?: number;
  reload: () => void;
}

export function useProductStock(product?: { id: string; sku?: string; isActive?: boolean }, enabled = true, withQuantity = false): ProductStock {
  const id = product?.id, sku = product?.sku;
  const batched = enabled && !!id && !!sku;
  const subscribe = useCallback((notify: () => void) => batched ? subscribeProductStock(sku!, notify) : () => {}, [batched, sku]);
  const snapshot = useCallback(() => batched ? productStock.get(sku!) : null, [batched, sku]);
  const shared = useSyncExternalStore(subscribe, snapshot, () => null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([id, sku, product?.isActive, revision, withQuantity]);
  const [result, setResult] = useState<{ key: string; status: StockStatus; availableQuantity?: number } | null>(null);
  useEffect(() => {
    if (!enabled || !id || sku) return;
    const controller = new AbortController();
    const stop = automaticRefresh(async () => {
      try {
        // One available unit determines whether the product is sold out. The
        // requested quantity is checked separately when adding or checking out.
        const state = await getProductPurchaseState({ id }, 1, controller.signal);
        if (withQuantity) throw new Error("Chưa xác nhận được SKU để đọc số lượng khả dụng.");
        if (!controller.signal.aborted) setResult({ key,
          status: !state.isActive ? "inactive" : state.available ? "available" : "sold_out" });
      } catch {
        if (!controller.signal.aborted) setResult({ key, status: "error" });
      }
      return !controller.signal.aborted;
    }, 15000);
    return () => { controller.abort(); stop(); };
  }, [id, sku, key, enabled, withQuantity]);
  const reload = useCallback(() => {
    if (batched) productStock.reload(sku!);
    else setRevision(value => value + 1);
  }, [batched, sku]);
  if (batched) {
    let status: StockStatus = product?.isActive === false ? "inactive" : "checking";
    if (shared) status = shared.id === id || shared.status === "error" ? shared.status : "error";
    return { status, availableQuantity: withQuantity && shared?.id === id ? shared.availableQuantity : undefined, reload };
  }
  return { status: result?.key === key ? result.status : product?.isActive === false ? "inactive" : "checking",
    availableQuantity: result?.key === key ? result.availableQuantity : undefined, reload };
}

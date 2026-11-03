"use client";

import { useCallback, useEffect, useState } from "react";
import { automaticRefresh } from "@/lib/automaticRefresh";
import { getProductPurchaseState } from "./client";
import { getAvailability } from "@/lib/shopping/availability";

type StockStatus = "checking" | "available" | "sold_out" | "inactive" | "error";
export interface ProductStock {
  status: StockStatus;
  availableQuantity?: number;
  reload: () => void;
}

export function useProductStock(product?: { id: string; sku?: string; isActive?: boolean }, enabled = true, withQuantity = false): ProductStock {
  const id = product?.id, sku = product?.sku;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([id, sku, product?.isActive, revision, withQuantity]);
  const [result, setResult] = useState<{ key: string; status: StockStatus; availableQuantity?: number } | null>(null);
  useEffect(() => {
    if (!enabled || !id) return;
    const controller = new AbortController();
    const stop = automaticRefresh(async () => {
      try {
        // One available unit determines whether the product is sold out. The
        // requested quantity is checked separately when adding or checking out.
        const [state, inventory] = await Promise.all([
          getProductPurchaseState({ id, sku }, 1, controller.signal),
          withQuantity && sku ? getAvailability([sku], controller.signal) : Promise.resolve(null),
        ]);
        const availableQuantity = inventory && sku ? inventory.quantities[sku] : undefined;
        if (withQuantity && availableQuantity === undefined) throw new Error("Chưa xác nhận được số lượng khả dụng.");
        if (!controller.signal.aborted) setResult({ key, availableQuantity,
          status: !state.isActive ? "inactive" : state.available && availableQuantity !== 0 ? "available" : "sold_out" });
      } catch {
        if (!controller.signal.aborted) setResult({ key, status: "error" });
      }
      return !controller.signal.aborted;
    }, 15000);
    return () => { controller.abort(); stop(); };
  }, [id, sku, key, enabled, withQuantity]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  return { status: result?.key === key ? result.status : product?.isActive === false ? "inactive" : "checking",
    availableQuantity: result?.key === key ? result.availableQuantity : undefined, reload };
}

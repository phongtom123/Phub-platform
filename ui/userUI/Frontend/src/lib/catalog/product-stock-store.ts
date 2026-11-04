"use client";

import { automaticRefresh } from "@/lib/automaticRefresh";
import { getProductPurchaseStates } from "./client";
import { STOCK_REFRESH_MS, StockBatch } from "./stock-batch";

export const productStock = new StockBatch(getProductPurchaseStates);
let stopRefreshing: (() => void) | undefined;

export function subscribeProductStock(sku: string, notify: () => void) {
  const unsubscribe = productStock.subscribe(sku, notify);
  if (!stopRefreshing) {
    let initial = true;
    stopRefreshing = automaticRefresh(async () => {
      // subscribe() handles initial loads and fresh RAM cache hits.
      if (initial) initial = false;
      else productStock.refreshActive();
      return true;
    }, STOCK_REFRESH_MS);
  }
  return () => {
    unsubscribe();
    if (!productStock.activeCount) { stopRefreshing?.(); stopRefreshing = undefined; }
  };
}

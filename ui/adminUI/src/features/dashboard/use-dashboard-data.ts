"use client";

import { useEffect, useState } from "react";
import { inventoryByWarehouse, readAllRows, readCount, vietnamDay, type ChartValue, type InventoryStat, type OrderStat, type WarehouseStat } from "./dashboard-data";
import { invalidateAdminCache, sameAdminData } from "@/src/lib/admin-fetch";
import { useAdminPolling } from "@/src/lib/use-admin-polling";

type Load<T> = { loading: boolean; data: T | null; error: string };
const pending = <T,>(): Load<T> => ({ loading: true, data: null, error: "" });
const message = (error: unknown) => error instanceof Error ? error.message : "Không kết nối được API.";
function settled<T>(read: PromiseSettledResult<T>): T {
  if (read.status === "rejected") throw read.reason;
  return read.value;
}

export function useDashboardData() {
  const [version, setVersion] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countErrors, setCountErrors] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Load<OrderStat[]>>(pending);
  const [inventory, setInventory] = useState<Load<ChartValue[]>>(pending);
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController(), signal = controller.signal;
    setToday(vietnamDay(new Date()));
    setReady(false); setCounts({}); setCountErrors({}); setOrders(pending()); setInventory(pending());
    const reads: Promise<unknown>[] = [];
    const failCount = (resource: string, error: unknown) => {
      if (!signal.aborted) setCountErrors(current => ({ ...current, [resource]: message(error) }));
    };
    const count = (resource: string, value: number) => {
      if (!signal.aborted) setCounts(current => ({ ...current, [resource]: value }));
    };
    for (const resource of ["products", "customers"]) {
      reads.push(readCount(resource, signal).then(total => count(resource, total)).catch(error => failCount(resource, error)));
    }
    reads.push(readAllRows<OrderStat>("orders", signal).then(data => {
      if (!signal.aborted) { setOrders({ loading: false, data, error: "" }); count("orders", data.length); }
    }).catch(error => {
      if (!signal.aborted) { setOrders({ loading: false, data: null, error: message(error) }); failCount("orders", error); }
    }));
    reads.push(Promise.allSettled([readAllRows<InventoryStat>("inventory", signal), readAllRows<WarehouseStat>("warehouses", signal)]).then(([rows, warehouses]) => {
      const inventoryRows = settled(rows), data = inventoryByWarehouse(inventoryRows, settled(warehouses));
      if (!signal.aborted) { setInventory({ loading: false, data, error: "" }); count("inventory", inventoryRows.length); }
    }).catch(error => {
      if (!signal.aborted) { setInventory({ loading: false, data: null, error: message(error) }); failCount("inventory", error); }
    }));
    void Promise.allSettled(reads).then(() => { if (!signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [version]);
  const pollError = useAdminPolling(String(version), ready, async (signal, canApply) => {
    // Wait for every reader even if one fails, so the next cycle cannot overlap leftovers.
    const reads = await Promise.allSettled([
      readCount("products", signal, true), readCount("customers", signal, true), readAllRows<OrderStat>("orders", signal, true),
      readAllRows<InventoryStat>("inventory", signal, true), readAllRows<WarehouseStat>("warehouses", signal, true),
    ]);
    const products = settled(reads[0]), customers = settled(reads[1]), freshOrders = settled(reads[2]), rows = settled(reads[3]), warehouses = settled(reads[4]);
    const freshInventory = inventoryByWarehouse(rows, warehouses);
    if (!canApply()) return;
    const counts = { products, customers, orders: freshOrders.length, inventory: rows.length };
    setCounts(current => sameAdminData(current, counts) ? current : counts); setCountErrors(current => Object.keys(current).length ? {} : current);
    setOrders(current => !current.error && sameAdminData(current.data, freshOrders) ? current : { loading: false, data: freshOrders, error: "" });
    setInventory(current => !current.error && sameAdminData(current.data, freshInventory) ? current : { loading: false, data: freshInventory, error: "" });
    setToday(vietnamDay(new Date()));
  });
  return { counts, countErrors, orders, inventory, today, pollError, refresh: () => { invalidateAdminCache(); setVersion(value => value + 1); } };
}

"use client";

import { useEffect, useState } from "react";
import { inventoryByWarehouse, readAllRows, readCount, vietnamDay, type ChartValue, type InventoryStat, type OrderStat, type WarehouseStat } from "./dashboard-data";

type Load<T> = { loading: boolean; data: T | null; error: string };
const pending = <T,>(): Load<T> => ({ loading: true, data: null, error: "" });
const message = (error: unknown) => error instanceof Error ? error.message : "Không kết nối được API.";

export function useDashboardData() {
  const [version, setVersion] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countErrors, setCountErrors] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Load<OrderStat[]>>(pending);
  const [inventory, setInventory] = useState<Load<ChartValue[]>>(pending);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(), signal = controller.signal;
    setToday(vietnamDay(new Date()));
    setCounts({}); setCountErrors({}); setOrders(pending()); setInventory(pending());
    const failCount = (resource: string, error: unknown) => {
      if (!signal.aborted) setCountErrors(current => ({ ...current, [resource]: message(error) }));
    };
    const count = (resource: string, value: number) => {
      if (!signal.aborted) setCounts(current => ({ ...current, [resource]: value }));
    };
    for (const resource of ["products", "customers"]) {
      readCount(resource, signal).then(total => count(resource, total)).catch(error => failCount(resource, error));
    }
    readAllRows<OrderStat>("orders", signal).then(data => {
      if (!signal.aborted) { setOrders({ loading: false, data, error: "" }); count("orders", data.length); }
    }).catch(error => {
      if (!signal.aborted) { setOrders({ loading: false, data: null, error: message(error) }); failCount("orders", error); }
    });
    Promise.all([readAllRows<InventoryStat>("inventory", signal), readAllRows<WarehouseStat>("warehouses", signal)]).then(([rows, warehouses]) => {
      const data = inventoryByWarehouse(rows, warehouses);
      if (!signal.aborted) { setInventory({ loading: false, data, error: "" }); count("inventory", rows.length); }
    }).catch(error => {
      if (!signal.aborted) { setInventory({ loading: false, data: null, error: message(error) }); failCount("inventory", error); }
    });
    return () => controller.abort();
  }, [version]);
  return { counts, countErrors, orders, inventory, today, refresh: () => setVersion(value => value + 1) };
}

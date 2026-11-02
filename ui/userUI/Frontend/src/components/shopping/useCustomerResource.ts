"use client";
import { useCallback, useEffect, useState } from "react";
import { shoppingRequest, ShoppingError } from "@/lib/shopping/client";
import { automaticRefresh } from "@/lib/automaticRefresh";
import { useShopping } from "./ShoppingProvider";
export function useCustomerResource<T>(
  path: string,
  validate: (value: unknown) => T,
  refreshEvery = 0,
) {
  const shop = useShopping();
  const identity = shop.customer?.customer_id;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([identity, path, refreshEvery > 0 ? null : revision]);
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!identity || shop.authStatus !== "authenticated") return;
    const controller = new AbortController();
    const stop = automaticRefresh(async () => {
      try {
        const data = await shoppingRequest(path, { signal: controller.signal }, validate);
        if (!controller.signal.aborted) setResult({ key, data, error: "" });
      } catch (error) {
        const denied = error instanceof ShoppingError && [401, 403, 404].includes(error.status);
        if (!controller.signal.aborted)
          setResult(previous => ({
            key,
            data: refreshEvery > 0 && !denied && previous?.key === key ? previous.data : null,
            error:
              error instanceof Error ? error.message : "Không thể tải dữ liệu.",
          }));
        if (denied) return false;
      }
      return !controller.signal.aborted;
    }, refreshEvery);
    return () => { controller.abort(); stop(); };
  }, [identity, path, key, validate, shop.authStatus, revision, refreshEvery]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const current = result?.key === key ? result : null;
  return {
    data: current?.data || null,
    error: current?.error || "",
    loading: !current,
    reload,
  };
}

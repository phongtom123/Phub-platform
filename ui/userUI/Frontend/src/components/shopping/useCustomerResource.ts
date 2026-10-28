"use client";
import { useEffect, useState } from "react";
import { shoppingRequest } from "@/lib/shopping/client";
import { useShopping } from "./ShoppingProvider";
export function useCustomerResource<T>(
  path: string,
  validate: (value: unknown) => T,
) {
  const shop = useShopping();
  const identity = shop.customer?.customer_id;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([identity, path, revision]);
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!identity || shop.authStatus !== "authenticated") return;
    const controller = new AbortController();
    shoppingRequest(path, { signal: controller.signal }, validate)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            data: null,
            error:
              error instanceof Error ? error.message : "Không thể tải dữ liệu.",
          });
      });
    return () => controller.abort();
  }, [identity, path, key, validate, shop.authStatus]);
  const current = result?.key === key ? result : null;
  return {
    data: current?.data || null,
    error: current?.error || "",
    loading: !current,
    reload: () => setRevision((value) => value + 1),
  };
}

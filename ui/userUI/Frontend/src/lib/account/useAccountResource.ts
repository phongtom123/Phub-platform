"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { accountRequest, AccountApiError } from "./client";

export const AccountAccessContext = createContext<(message: string) => void>(() => {});
export function useAccountResource<T>(path: string, parse: (value: unknown) => T) {
  const onAccessError = useContext(AccountAccessContext);
  const [version, setVersion] = useState(0);
  const key = `${path}:${version}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key: "", data: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    accountRequest(path, parse, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ key, data, error: "" });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AccountApiError && [401, 403].includes(error.status)) onAccessError(error.message);
      setState({ key, data: null, error: error instanceof Error ? error.message : "Không thể tải dữ liệu." });
    });
    return () => controller.abort();
  }, [path, key, parse, onAccessError]);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "", loading: state.key !== key, reload: () => setVersion(current => current + 1) };
}

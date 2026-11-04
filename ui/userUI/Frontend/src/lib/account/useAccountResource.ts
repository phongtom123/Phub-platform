"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { accountRequest, AccountApiError } from "./client";
import { automaticRefresh } from "../automaticRefresh";

export const AccountAccessContext = createContext<(message: string) => void>(() => {});
export function useAccountResource<T>(path: string, parse: (value: unknown) => T, refreshEvery = 0) {
  const onAccessError = useContext(AccountAccessContext);
  const [version, setVersion] = useState(0);
  const key = `${path}:${refreshEvery > 0 ? "live" : version}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key: "", data: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    const stop = automaticRefresh(async () => {
      try {
        const data = await accountRequest(path, parse, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ key, data, error: "" });
      } catch (error) {
        if (controller.signal.aborted) return false;
        const denied = error instanceof AccountApiError && [401, 403, 404].includes(error.status);
        if (error instanceof AccountApiError && [401, 403].includes(error.status)) onAccessError(error.message);
        setState(previous => ({ key, data: refreshEvery > 0 && !denied && previous.key === key ? previous.data : null, error: error instanceof Error ? error.message : "Không thể tải dữ liệu." }));
        if (denied) return false;
      }
      return !controller.signal.aborted;
    }, refreshEvery);
    return () => { controller.abort(); stop(); };
  }, [path, key, parse, onAccessError, version, refreshEvery]);
  const reload = useCallback(() => setVersion(current => current + 1), []);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "", loading: state.key !== key, reload };
}

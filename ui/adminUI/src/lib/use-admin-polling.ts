"use client";

import { useEffect, useRef, useState } from "react";
import { getAdminMutationEpoch, getSessionEpoch } from "./admin-fetch";

export const ADMIN_POLL_INTERVAL_MS = 10_000;
type Read = (signal: AbortSignal, canApply: () => boolean) => Promise<void>;

/** Read-only polling, not realtime. Schedule after completion to avoid slow-server overlap. */
export function useAdminPolling(identity: string, enabled: boolean, read: Read) {
  const latest = useRef({ identity, enabled, read });
  latest.current = { identity, enabled, read };
  const [error, setError] = useState("");
  const opened = useRef<string | null>(null);
  useEffect(() => {
    setError("");
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    const available = () => !stopped && latest.current.enabled && latest.current.identity === identity &&
      document.visibilityState !== "hidden" && navigator.onLine !== false &&
      !document.activeElement?.matches("input, textarea, select, [contenteditable=true]");
    const tick = async () => {
      if (available()) {
        controller = new AbortController();
        const signal = controller.signal, mutation = getAdminMutationEpoch(), session = getSessionEpoch();
        const canApply = () => !signal.aborted && available() && mutation === getAdminMutationEpoch() && session === getSessionEpoch();
        try {
          await latest.current.read(signal, canApply);
          if (canApply()) setError("");
        } catch (cause) {
          if (canApply()) setError(cause instanceof Error ? cause.message : "Không kết nối được API.");
        }
      }
      if (!stopped) timer = setTimeout(tick, ADMIN_POLL_INTERVAL_MS);
    };
    // Revalidate immediately after showing a warm snapshot, then every 10s.
    // The cache coalesces reads that completed just before mount.
    if (opened.current !== identity) { opened.current = identity; void tick(); }
    else timer = setTimeout(tick, ADMIN_POLL_INTERVAL_MS); // Editing/saving just ended; don't refetch a successful write eagerly.
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [identity, enabled]);
  return error;
}

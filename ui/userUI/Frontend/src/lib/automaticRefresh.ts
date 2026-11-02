/** One request at a time; refresh visible pages and resume on focus/reconnect. */
export function automaticRefresh(load: () => Promise<boolean>, intervalMs: number) {
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (!stopped && intervalMs > 0) timer = setTimeout(() => void refresh(), intervalMs);
  };
  async function refresh(initial = false) {
    if (stopped || busy) return;
    clearTimeout(timer);
    if (!initial && (document.visibilityState === "hidden" || navigator.onLine === false)) {
      schedule();
      return;
    }
    busy = true;
    try {
      if (!await load()) stopped = true;
    } finally {
      busy = false;
      schedule();
    }
  }
  const resume = () => { void refresh(); };
  if (intervalMs > 0) {
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
  }
  void refresh(true);
  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}

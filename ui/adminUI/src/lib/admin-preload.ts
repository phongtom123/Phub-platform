import { adminFetch, getAdminMutationEpoch, getSessionEpoch } from "./admin-fetch";

export const ADMIN_PRELOAD_CONCURRENCY = 2;
const MAX_RESOURCES = 40;
const REQUEST_TIMEOUT_MS = 12_000;
type Resource = { name: string };

/** Warm first pages only. Never crawl customer history, all rows or all detail records. */
export async function preloadAdminData(signal: AbortSignal, canRun: () => boolean, prefetchRoute: (href: string) => void = () => {}) {
  const session = getSessionEpoch(), mutation = getAdminMutationEpoch();
  let stop = false;
  const alive = () => !stop && !signal.aborted && session === getSessionEpoch() && mutation === getAdminMutationEpoch();
  const pause = () => new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, 250);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
  async function read(path: string) {
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
    try {
      if (!alive()) return null;
      const response = await adminFetch(path, { signal: request.signal, cache: "no-store" });
      if (response.status === 401 || response.status >= 500) stop = true;
      if (!response.ok || !alive()) return null;
      return await response.json();
    } catch { return null; } // Speculative failure never replaces the active page's data/error.
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  }
  while (alive() && !canRun()) await pause();
  if (!alive()) return;
  const resources: unknown = await read("/api/backend/data/resources");
  if (!Array.isArray(resources) || !alive()) return;
  const names = [...new Set(resources.filter((item): item is Resource => Boolean(item && typeof item.name === "string" && /^[a-z][a-z-]{0,49}$/.test(item.name) && item.name !== "resources")).map(item => item.name))].slice(0, MAX_RESOURCES);
  const priority = ["products", "orders", "customers", "inventory", "warehouses", "accounts"];
  names.sort((a, b) => (priority.includes(a) ? priority.indexOf(a) : priority.length) - (priority.includes(b) ? priority.indexOf(b) : priority.length));
  const jobs = names.map(name => name === "accounts"
    ? { path: "/api/backend/admin/accounts?q=&page=1", href: "/accounts" }
    : { path: `/api/backend/data/${name}?page=1&page_size=20&q=`, href: `/data/${name}` });
  let cursor = 0;
  async function worker() {
    while (alive() && cursor < jobs.length) {
      while (alive() && !canRun()) await pause();
      if (!alive()) return;
      const job = jobs[cursor++];
      const body = await read(job.path);
      if (alive() && body && Array.isArray(body.data)) {
        try { prefetchRoute(job.href); } catch { /* Route warming is optional, data remains usable. */ }
      }
      await pause(); // Yield to foreground navigation between speculative reads.
    }
  }
  await Promise.all(Array.from({ length: ADMIN_PRELOAD_CONCURRENCY }, worker));
}

/** UI invalidation only. Authorization remains on every protected backend API. */
export const ADMIN_SESSION_EXPIRED = "phub-admin-session-expired";
let sessionEpoch = 0;
let cacheGeneration = 0;
let mutationEpoch = 0;
export const getAdminMutationEpoch = () => mutationEpoch;
type Snapshot = { body: ArrayBuffer; status: number; statusText: string; headers: [string, string][] };
type Entry = { snapshot: Snapshot; checkedAt: number };
type Flight = { promise: Promise<Snapshot>; controller: AbortController; users: number; settled: boolean };
const entries = new Map<string, Entry>();
const flights = new Map<string, Flight>();
const MAX_ENTRIES = 80;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
// No TTL. no-cache revalidates in the background; reuse a just-completed read
// for one second to avoid duplicating cold loads/prefetch on mount.
const REVALIDATE_DEDUPE_MS = 1_000;

export const sameAdminData = (before: unknown, after: unknown) => JSON.stringify(before) === JSON.stringify(after);

/** Application memory only, never the browser HTTP cache, localStorage or a CDN. */
export function invalidateAdminCache(paths?: readonly string[]): void {
  if (paths) {
    const matches = (key: string) => paths.includes(key.split("?")[0]);
    for (const key of entries.keys()) if (matches(key)) entries.delete(key);
    for (const key of flights.keys()) if (matches(key)) flights.delete(key);
    return;
  }
  cacheGeneration++;
  entries.clear();
  // Existing readers own their requests, but new readers must not join a pre-write flight.
  flights.clear();
}

export const getSessionEpoch = () => sessionEpoch;
export const advanceSessionEpoch = () => { invalidateAdminCache(); return ++sessionEpoch; };

async function verifiedFetch(input: RequestInfo | URL, options: RequestInit | undefined, epoch: number): Promise<Response> {
  const response = await fetch(input, options);
  // A response started under a previous login must not affect the new session.
  if (epoch !== getSessionEpoch() || options?.signal?.aborted) throw new DOMException("Phiên hoặc yêu cầu đã thay đổi.", "AbortError");
  if (response.status === 401 && typeof window !== "undefined") {
    invalidateAdminCache();
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED, { detail: epoch }));
  }
  // A resource-level 403 is a permission error, not evidence of an expired session.
  return response;
}

function cacheKey(input: RequestInfo | URL, options?: RequestInit): { key: string } | null {
  // Never share protected data between server requests or across browser origins.
  if (typeof window === "undefined" || !window.location || typeof input !== "string" ||
    options?.credentials === "omit" || (options?.headers && [...new Headers(options.headers)].length)) return null;
  const url = new URL(input, window.location.origin);
  if (url.origin !== window.location.origin || !/^\/api\/backend\/(data\/[a-z-]+|admin\/(accounts(?:\/[A-Za-z0-9_.-]+)?|account-owners))$/.test(url.pathname)) return null;
  url.searchParams.sort();
  return { key: url.pathname + url.search };
}

function sameBody(before: Snapshot, after: Snapshot) {
  if (before.body.byteLength !== after.body.byteLength) return false;
  const a = new Uint8Array(before.body), b = new Uint8Array(after.body);
  return a.every((value, index) => value === b[index]);
}

function resourceFamily(key: string) {
  const path = key.split("?")[0];
  return path.startsWith("/api/backend/admin/accounts/") ? "/api/backend/admin/accounts" : path;
}

function remember(key: string, snapshot: Snapshot) {
  if (snapshot.body.byteLength > MAX_ENTRY_BYTES) return;
  const previous = entries.get(key);
  // Only a confirmed change evicts other views of this resource. A failed or
  // unchanged background read must not destroy useful navigation snapshots.
  if (previous && !sameBody(previous.snapshot, snapshot)) {
    const family = resourceFamily(key);
    for (const other of entries.keys()) if (other !== key && resourceFamily(other) === family) entries.delete(other);
    for (const other of flights.keys()) if (other !== key && resourceFamily(other) === family) flights.delete(other);
  }
  entries.delete(key);
  entries.set(key, { snapshot: previous && sameBody(previous.snapshot, snapshot) ? previous.snapshot : snapshot, checkedAt: Date.now() });
  let bytes = [...entries.values()].reduce((total, value) => total + value.snapshot.body.byteLength, 0);
  for (const [key, value] of entries) {
    if (entries.size <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
    entries.delete(key); bytes -= value.snapshot.body.byteLength;
  }
}

function responseFrom(snapshot: Snapshot) {
  return new Response([204, 205, 304].includes(snapshot.status) ? null : snapshot.body.slice(0), {
    status: snapshot.status, statusText: snapshot.statusText, headers: snapshot.headers,
  });
}

function subscribe(key: string, flight: Flight, signal: AbortSignal | null | undefined, epoch: number): Promise<Response> {
  flight.users++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      if (--flight.users === 0 && !flight.settled) {
        // React Strict Mode may remount a reader in the same turn. Let it join
        // before cancelling, while still cancelling genuinely abandoned reads.
        queueMicrotask(() => {
          if (flight.users || flight.settled) return;
          flight.controller.abort();
          if (flights.get(key) === flight) flights.delete(key);
        });
      }
    };
    const abort = () => {
      if (finished) return;
      finished = true; cleanup(); reject(new DOMException("Yêu cầu đã bị hủy.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    flight.promise.then(snapshot => {
      if (finished) return;
      finished = true; cleanup();
      if (epoch !== getSessionEpoch()) reject(new DOMException("Phiên đăng nhập đã thay đổi.", "AbortError"));
      else resolve(responseFrom(snapshot));
    }, error => { if (!finished) { finished = true; cleanup(); reject(error); } });
  });
}

export async function adminFetch(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const epoch = getSessionEpoch();
  const method = (options?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  if (options?.signal?.aborted) throw new DOMException("Yêu cầu đã bị hủy.", "AbortError");
  if (!["GET", "HEAD"].includes(method)) {
    mutationEpoch++;
    invalidateAdminCache();
    try { return await verifiedFetch(input, options, epoch); }
    finally { if (epoch === getSessionEpoch()) { mutationEpoch++; invalidateAdminCache(); } } // A failed/timeout write may already have committed.
  }
  const cache = method === "GET" ? cacheKey(input, options) : null;
  if (!cache) return verifiedFetch(input, options, epoch);
  const { key } = cache;
  const fresh = options?.cache === "reload" || options?.cache === "no-cache";
  const entry = entries.get(key);
  if (entry && (!fresh || (options?.cache === "no-cache" && Date.now() - entry.checkedAt < REVALIDATE_DEDUPE_MS))) {
    entries.delete(key); entries.set(key, entry);
    // A logout/navigation can happen before this async cache hit is consumed.
    await Promise.resolve();
    if (epoch !== getSessionEpoch() || options?.signal?.aborted) throw new DOMException("Phiên hoặc yêu cầu đã thay đổi.", "AbortError");
    return responseFrom(entry.snapshot);
  }
  let flight = flights.get(key);
  if (!flight || flight.controller.signal.aborted) {
    const generation = cacheGeneration;
    const controller = new AbortController();
    const next: Flight = { controller, users: 0, settled: false, promise: undefined as unknown as Promise<Snapshot> };
    next.promise = (async () => {
      const response = await verifiedFetch(input, { ...options, cache: "no-store", signal: controller.signal }, epoch);
      const snapshot: Snapshot = { body: await response.arrayBuffer(), status: response.status,
        statusText: response.statusText, headers: [...response.headers] };
      if (epoch !== getSessionEpoch() || controller.signal.aborted) throw new DOMException("Phiên hoặc yêu cầu đã thay đổi.", "AbortError");
      if (response.status === 403 || response.status === 404) invalidateAdminCache([key.split("?")[0]]);
      if (generation === cacheGeneration && flights.get(key) === next && snapshot.body.byteLength <= MAX_ENTRY_BYTES && response.status === 200 &&
        response.headers.get("content-type")?.includes("application/json") && !response.headers.has("set-cookie")) {
        // Invalid JSON/HTML/error responses must never become a successful cache hit.
        try { JSON.parse(new TextDecoder().decode(snapshot.body)); remember(key, snapshot); } catch { /* No cache. */ }
      }
      return snapshot;
    })().finally(() => { next.settled = true; if (flights.get(key) === next) flights.delete(key); });
    flight = next; flights.set(key, next);
  }
  return subscribe(key, flight, options?.signal, epoch);
}

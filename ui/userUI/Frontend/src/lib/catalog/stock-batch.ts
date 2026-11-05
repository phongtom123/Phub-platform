/** Public display data only. Cart/checkout validation never reads this cache. */
export type StockStatus = "checking" | "available" | "sold_out" | "inactive" | "error";
export interface PurchaseState { id: string; sku: string; is_active: boolean; available_quantity: number }
export interface StockSnapshot { id: string; status: StockStatus; availableQuantity?: number }
type Entry = { snapshot: StockSnapshot | null; updated: number; version: number; listeners: Set<() => void> };
type Loader = (skus: string[], signal: AbortSignal) => Promise<PurchaseState[]>;

export const STOCK_REFRESH_MS = 15_000;
export class StockBatch {
  private entries = new Map<string, Entry>();
  private pending = new Set<string>();
  private inFlight = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | undefined;
  private running = false;
  private subscribers = 0;
  private now: () => number;
  private delay: number;
  private limit: number;

  constructor(private load: Loader, options: { now?: () => number; delay?: number; cacheLimit?: number } = {}) {
    this.now = options.now ?? (() => performance.now());
    this.delay = options.delay ?? 25;
    this.limit = options.cacheLimit ?? 256;
  }
  get activeCount() { return this.subscribers; }
  get cacheSize() { return this.entries.size; }
  get(sku: string) { return this.entries.get(sku)?.snapshot ?? null; }

  subscribe(sku: string, notify: () => void) {
    let entry = this.entries.get(sku);
    if (!entry) {
      entry = { snapshot: null, updated: -Infinity, version: 0, listeners: new Set() };
    }
    this.entries.delete(sku);
    this.entries.set(sku, entry); // LRU; never evict an observed or pending entry.
    const listener = () => notify();
    entry.listeners.add(listener);
    this.subscribers++;
    if (!entry.snapshot || entry.snapshot.status === "error" || this.now() - entry.updated >= STOCK_REFRESH_MS) this.enqueue(sku);
    this.prune();
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      entry.listeners.delete(listener);
      this.subscribers--;
      if (!entry.listeners.size) this.pending.delete(sku);
      if (!this.subscribers) {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.pending.clear();
        this.controller?.abort();
      }
      this.prune();
    };
  }

  refreshActive() {
    for (const [sku, entry] of this.entries) if (entry.listeners.size) this.enqueue(sku);
  }
  reload(sku: string) {
    const entry = this.entries.get(sku);
    if (!entry) return;
    entry.version++;
    entry.snapshot = null;
    entry.updated = -Infinity;
    entry.listeners.forEach(notify => notify());
    // A manual retry supersedes an older in-flight response for this SKU.
    if (entry.listeners.size) { this.pending.add(sku); this.schedule(); }
  }
  private enqueue(sku: string) {
    if (this.inFlight.has(sku) && !this.controller?.signal.aborted) return;
    this.pending.add(sku);
    this.schedule();
  }
  private schedule() {
    if (!this.running && this.timer === undefined) this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.delay);
  }
  private async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.size && this.subscribers) {
        const skus = [...this.pending].filter(sku => this.entries.get(sku)?.listeners.size).sort().slice(0, 100);
        if (!skus.length) { this.pending.clear(); break; }
        const versions = new Map(skus.map(sku => [sku, this.entries.get(sku)!.version]));
        skus.forEach(sku => { this.pending.delete(sku); this.inFlight.add(sku); });
        const controller = new AbortController();
        this.controller = controller;
        try {
          const data = await this.load(skus, controller.signal);
          if (!controller.signal.aborted) {
            const rows = new Map(data.map(item => [item.sku, item]));
            for (const sku of skus) {
              const row = rows.get(sku);
              this.publish(sku, versions.get(sku)!, row ? {
                id: row.id, availableQuantity: row.available_quantity,
                status: !row.is_active ? "inactive" : row.available_quantity > 0 ? "available" : "sold_out",
              } : { id: "", status: "error" }); // Hidden/deleted/missing is not a sold-out fallback.
            }
          }
        } catch {
          if (!controller.signal.aborted) for (const sku of skus) this.publish(sku, versions.get(sku)!, { id: "", status: "error" });
        } finally {
          skus.forEach(sku => this.inFlight.delete(sku));
          if (this.controller === controller) this.controller = undefined;
        }
      }
    } finally {
      this.running = false;
      this.prune();
      if (this.pending.size && this.subscribers) this.schedule();
    }
  }
  private publish(sku: string, version: number, snapshot: StockSnapshot) {
    const entry = this.entries.get(sku);
    if (!entry || entry.version !== version) return;
    entry.snapshot = snapshot;
    entry.updated = this.now();
    entry.listeners.forEach(notify => notify());
  }
  private prune() {
    for (const [sku, entry] of this.entries) {
      if (this.entries.size <= this.limit) break;
      if (!entry.listeners.size && !this.pending.has(sku) && !this.inFlight.has(sku)) this.entries.delete(sku);
    }
  }
}

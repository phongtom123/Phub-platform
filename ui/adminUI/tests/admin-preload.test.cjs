const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/admin-preload.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function load(fetch, state = { session: 0, mutation: 0 }) {
  const sandbox = { exports: {}, AbortController, setTimeout: (fn, ms) => setTimeout(fn, ms === 12000 ? 100 : 1), clearTimeout,
    require: () => ({ adminFetch: fetch, getSessionEpoch: () => state.session, getAdminMutationEpoch: () => state.mutation }) };
  vm.runInNewContext(source, sandbox);
  return sandbox.exports;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("preload warms only authorized first pages, deduplicates metadata names and caps API concurrency at two", async () => {
  const calls = [], routes = []; let active = 0, maximum = 0;
  const app = load(async (url, options) => {
    assert.equal(options.method, undefined); calls.push(url);
    if (url.endsWith("resources")) return json(["products", "customers", "accounts", "warehouses", "orders", "products", "../../auth", "resources"].map(name => ({ name })));
    maximum = Math.max(maximum, ++active); await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return json({ data: [], total: 1000000 });
  });
  await app.preloadAdminData(new AbortController().signal, () => true, href => routes.push(href));
  assert.equal(calls.length, 6); assert.equal(maximum, 2); assert.equal(routes.length, 5);
  assert.ok(calls.includes("/api/backend/admin/accounts?q=&page=1"));
  assert.ok(calls.every(url => url.endsWith("resources") || url.includes("page=1")));
  assert.ok(!calls.some(url => url.includes("page=2") || url.includes("auth") || url.includes("key=")));
});

test("hidden/offline/typing pause is cancellable without fetching any data", async () => {
  let calls = 0; const controller = new AbortController();
  const app = load(async () => { calls++; return json([]); });
  const pending = app.preloadAdminData(controller.signal, () => false);
  setTimeout(() => controller.abort(), 5); await pending; assert.equal(calls, 0);
});

test("workers resuming together claim the final job only once", async () => {
  const calls = [], routes = [];
  let runnable = true, pausedWorkers = 0;
  const app = load(async url => {
    calls.push(url);
    if (url.endsWith("resources")) {
      runnable = false;
      return json([{ name: "products" }]);
    }
    return json({ data: [] });
  });
  await assert.doesNotReject(app.preloadAdminData(new AbortController().signal, () => {
    if (runnable) return true;
    if (++pausedWorkers === app.ADMIN_PRELOAD_CONCURRENCY) queueMicrotask(() => { runnable = true; });
    return false;
  }, href => routes.push(href)));
  assert.equal(pausedWorkers, 2);
  assert.deepEqual(calls, ["/api/backend/data/resources", "/api/backend/data/products?page=1&page_size=20&q="]);
  assert.deepEqual(routes, ["/data/products"]);
});

test("logout, a mutation, or server failure stop remaining speculative jobs without replaying writes", async () => {
  for (const reason of ["session", "mutation", "server"]) {
    const state = { session: 0, mutation: 0 }; let calls = 0;
    const app = load(async url => {
      if (url.endsWith("resources")) return json(["products", "customers", "orders", "inventory"].map(name => ({ name })));
      calls++;
      if (reason !== "server") state[reason]++;
      return json(reason === "server" ? { detail: "offline" } : { data: [] }, reason === "server" ? 503 : 200);
    }, state);
    await app.preloadAdminData(new AbortController().signal, () => true);
    assert.ok(calls <= 2);
  }
});

test("aborting the preload cancels in-flight readers and never schedules new jobs", async () => {
  const controller = new AbortController(); let active = 0, aborted = 0;
  const app = load(async (url, options) => {
    if (url.endsWith("resources")) return json(["products", "customers", "orders"].map(name => ({ name })));
    active++;
    return new Promise((_, reject) => options.signal.addEventListener("abort", () => { aborted++; reject(new Error("cancelled")); }));
  });
  const pending = app.preloadAdminData(controller.signal, () => true);
  await new Promise(resolve => setTimeout(resolve, 10)); controller.abort(); await pending;
  assert.equal(active, 2); assert.equal(aborted, 2);
});

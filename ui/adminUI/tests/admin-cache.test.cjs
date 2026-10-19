const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/admin-fetch.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", ...headers },
});
function load(fetch) {
  let now = 0;
  const events = [];
  const sandbox = { exports: {}, fetch, DOMException, CustomEvent, URL, Request, Response, Headers, AbortController,
    TextDecoder, queueMicrotask, Date: { now: () => now }, window: { location: { origin: "http://localhost:3000" }, dispatchEvent: event => events.push(event) } };
  vm.runInNewContext(code, sandbox);
  return { ...sandbox.exports, events, tick: milliseconds => { now += milliseconds; } };
}
const url = "/api/backend/data/products?page=1&page_size=20";

test("demo GET cache canonicalizes query order, isolates bodies and expires both data/metadata after 10 minutes", async () => {
  let calls = 0;
  const app = load(async () => json({ value: ++calls }));
  assert.deepEqual(await (await app.adminFetch(url)).json(), { value: 1 });
  const cached = await app.adminFetch("/api/backend/data/products?page_size=20&page=1");
  const body = await cached.json(); body.value = 999;
  assert.deepEqual(await (await app.adminFetch(url)).json(), { value: 1 });
  const metadata = "/api/backend/data/resources";
  await app.adminFetch(metadata); assert.equal(calls, 2);
  app.tick(599_999);
  assert.equal(calls, 2, "No polling or automatic background requests");
  assert.equal((await (await app.adminFetch(url)).json()).value, 1);
  await app.adminFetch(metadata); assert.equal(calls, 2);
  app.tick(2);
  assert.equal((await (await app.adminFetch(url)).json()).value, 3);
  await app.adminFetch(metadata); assert.equal(calls, 4);
});

test("search, page, order context, detail keys and endpoint types are distinct cache entries", async () => {
  let calls = 0;
  const app = load(async () => json({ value: ++calls }));
  const urls = [url, url + "&q=phone", url.replace("page=1", "page=2"), url + "&order_id=DH1", url + "&order_id=DH2",
    "/api/backend/data/warehouses?key=[-1]", '/api/backend/data/warehouses?key=["-1"]', "/api/backend/admin/accounts", "/api/backend/admin/accounts/AD1"];
  for (const value of urls) await app.adminFetch(value);
  for (const value of urls) await app.adminFetch(value);
  assert.equal(calls, urls.length);
});

test("concurrent GETs deduplicate; aborting one reader does not cancel another", async () => {
  let finish, requestSignal, calls = 0;
  const app = load((_url, options) => { calls++; requestSignal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  const first = new AbortController(), second = new AbortController();
  const a = app.adminFetch(url, { signal: first.signal });
  const b = app.adminFetch(url, { signal: second.signal });
  assert.equal(calls, 1);
  const aborted = assert.rejects(a, error => error.name === "AbortError"); first.abort(); await aborted;
  assert.equal(requestSignal.aborted, false);
  finish(json({ ok: true })); assert.deepEqual(await (await b).json(), { ok: true });
  await app.adminFetch(url); assert.equal(calls, 1);
});

test("all readers aborting cancels the flight; a new reader never joins that abandoned request", async () => {
  let finish, oldSignal, calls = 0;
  const app = load((_url, options) => {
    calls++;
    if (calls === 1) { oldSignal = options.signal; return new Promise(resolve => { finish = resolve; }); }
    return Promise.resolve(json({ value: calls }));
  });
  const controller = new AbortController();
  const pending = app.adminFetch(url, { signal: controller.signal });
  const aborted = assert.rejects(pending, error => error.name === "AbortError"); controller.abort(); await aborted;
  assert.equal(oldSignal.aborted, true);
  assert.equal((await (await app.adminFetch(url)).json()).value, 2);
  finish(json({ value: 1 })); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await (await app.adminFetch(url)).json()).value, 2);
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(app.adminFetch(url, { signal: alreadyAborted.signal }), error => error.name === "AbortError");
  assert.equal(calls, 2);
});

test("a same-turn React remount joins the pending read instead of starting another fetch", async () => {
  let calls = 0, finish;
  const app = load(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const controller = new AbortController();
  const first = app.adminFetch(url, { signal: controller.signal });
  const aborted = assert.rejects(first, error => error.name === "AbortError"); controller.abort();
  const remount = app.adminFetch(url);
  finish(json({ value: 1 })); await aborted;
  assert.equal((await (await remount).json()).value, 1); assert.equal(calls, 1);
});

test("even cache hits reject when their reader aborts or logs out before consuming the promise", async () => {
  let calls = 0;
  const app = load(async () => json({ value: ++calls }));
  await app.adminFetch(url);
  const hit = app.adminFetch(url); app.advanceSessionEpoch();
  await assert.rejects(hit, error => error.name === "AbortError");
  await app.adminFetch(url);
  const controller = new AbortController();
  const abortedHit = app.adminFetch(url, { signal: controller.signal }); controller.abort();
  await assert.rejects(abortedHit, error => error.name === "AbortError"); assert.equal(calls, 2);
});

test("a late mutation from a prior login cannot evict the current login's warm cache", async () => {
  let reads = 0, finish;
  const app = load((_url, options) => options?.method === "PATCH"
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(json({ value: ++reads })));
  await app.adminFetch(url);
  const pending = app.adminFetch(url, { method: "PATCH" });
  app.advanceSessionEpoch(); await app.adminFetch(url);
  const rejected = assert.rejects(pending, error => error.name === "AbortError"); finish(json({})); await rejected;
  assert.equal((await (await app.adminFetch(url)).json()).value, 2); assert.equal(reads, 2);
});

test("successful, failed and timed-out writes invalidate reads without ever replaying mutations", async () => {
  for (const result of [200, 503, "timeout"]) {
    let reads = 0, writes = 0;
    const app = load(async (_url, options) => {
      if (options?.method === "PATCH") {
        writes++; if (result === "timeout") throw new Error("timeout"); return json({}, result);
      }
      return json({ value: ++reads });
    });
    await app.adminFetch(url); await app.adminFetch(url);
    const write = app.adminFetch("/api/backend/data/products?key=[1]", { method: "PATCH", body: "{}" });
    if (result === "timeout") await assert.rejects(write); else await write;
    assert.equal((await (await app.adminFetch(url)).json()).value, 2);
    assert.equal(writes, 1);
  }
});

test("refresh and session changes clear cache; late reads cannot repopulate cleared snapshots", async () => {
  let calls = 0, finish;
  const app = load(async () => { calls++; if (calls === 2) return new Promise(resolve => { finish = resolve; }); return json({ value: calls }); });
  await app.adminFetch(url); app.invalidateAdminCache();
  const pending = app.adminFetch(url);
  app.invalidateAdminCache(); assert.equal((await (await app.adminFetch(url)).json()).value, 3);
  finish(json({ value: 2 })); await pending;
  assert.equal((await (await app.adminFetch(url)).json()).value, 3);
  app.advanceSessionEpoch(); assert.equal((await (await app.adminFetch(url)).json()).value, 4);
  await app.adminFetch(url, { cache: "reload" }); assert.equal(calls, 5);
});

test("a previous login's late success/401 cannot restore data or invalidate the new login", async () => {
  for (const status of [200, 401]) {
    let finish, calls = 0;
    const app = load(() => { calls++; return calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(json({ session: "new" })); });
    const pending = app.adminFetch(url);
    app.advanceSessionEpoch(); await app.adminFetch(url);
    const rejected = assert.rejects(pending, error => error.name === "AbortError");
    finish(json({ session: "old" }, status)); await rejected;
    assert.deepEqual(await (await app.adminFetch(url)).json(), { session: "new" });
    assert.equal(app.events.length, 0); assert.equal(calls, 2);
  }
});

test("errors, invalid JSON, cookies, auth/current profile and alternate credentials are never cached", async () => {
  for (const response of [() => json({}, 401), () => json({}, 403), () => json({}, 503),
    () => new Response("invalid", { headers: { "Content-Type": "application/json" } }),
    () => new Response("<html>offline</html>", { headers: { "Content-Type": "text/html" } }),
    () => json({}, 200, { "Set-Cookie": "private" })]) {
    let calls = 0;
    const app = load(async () => { calls++; return response(); });
    await app.adminFetch(url); await app.adminFetch(url); assert.equal(calls, 2);
  }
  for (const [target, options] of [["/api/backend/auth/me"], ["/api/backend/admin/me"], ["https://other.test/api/backend/data/products"],
    [url, { credentials: "omit" }], [url, { headers: { Authorization: "Bearer test-only" } }]]) {
    let calls = 0;
    const app = load(async () => { calls++; return json({}); });
    await app.adminFetch(target, options); await app.adminFetch(target, options); assert.equal(calls, 2);
  }
});

test("LRU count, total byte budget and per-entry limit keep private memory bounded", async () => {
  let calls = 0;
  const app = load(async () => json({ value: ++calls }));
  for (let page = 1; page <= 81; page++) await app.adminFetch(`/api/backend/data/products?page=${page}`);
  await app.adminFetch("/api/backend/data/products?page=81"); assert.equal(calls, 81);
  await app.adminFetch("/api/backend/data/products?page=1"); assert.equal(calls, 82);
  let largeCalls = 0;
  const large = load(async () => { largeCalls++; return json({ text: "x".repeat(1024 * 1024) }); });
  for (let page = 1; page <= 9; page++) await large.adminFetch(`/api/backend/data/products?page=${page}`);
  await large.adminFetch("/api/backend/data/products?page=1"); assert.equal(largeCalls, 10);
  let oversizeCalls = 0;
  const oversize = load(async () => { oversizeCalls++; return json({ text: "x".repeat(2 * 1024 * 1024) }); });
  await oversize.adminFetch(url); await oversize.adminFetch(url); assert.equal(oversizeCalls, 2);
});

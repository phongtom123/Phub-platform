const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/admin-fetch.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function load(fetch) {
  const events = [];
  const sandbox = { exports: {}, fetch, DOMException, CustomEvent, window: { dispatchEvent: event => events.push(event) } };
  vm.runInNewContext(code, sandbox);
  return { client: sandbox.exports, events };
}

test("401 invalidates UI, but resource 403 and network/503 never log out", async () => {
  for (const status of [200, 401, 403, 503]) {
    const { client, events } = load(async () => new Response(null, { status }));
    assert.equal((await client.adminFetch("/api/backend/data/products")).status, status);
    assert.equal(events.length, status === 401 ? 1 : 0);
    if (events.length) assert.equal(events[0].detail, client.getSessionEpoch());
  }
  let calls = 0;
  const { client, events } = load(async () => { calls++; throw new Error("offline"); });
  await assert.rejects(client.adminFetch("/api/backend/admin/accounts", { method: "POST" }), /offline/);
  assert.equal(events.length, 0);
  assert.equal(calls, 1, "Never replay a write automatically");
});

test("late success/401 from an earlier session cannot affect a new login", async () => {
  for (const status of [200, 401]) {
    let finish;
    const { client, events } = load(() => new Promise(resolve => { finish = resolve; }));
    const pending = client.adminFetch("/api/backend/data/products");
    client.advanceSessionEpoch();
    finish(new Response(null, { status }));
    await assert.rejects(pending, error => error.name === "AbortError");
    assert.equal(events.length, 0);
  }
});

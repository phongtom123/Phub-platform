// Run: node --test ui/shared/tests/backend-route.test.cjs (admin npm install first).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../../adminUI/node_modules/typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../backend-route.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function gateway(fetch, env = {}) {
  const sandbox = { exports: {}, process: { env }, URL, Request, Response, Headers, TextEncoder, AbortSignal, fetch };
  vm.runInNewContext(code, sandbox);
  return (request, segments) => sandbox.exports.proxyBackend(request, { params: Promise.resolve({ path: segments }) });
}

test("allowlist rejects traversal and arbitrary backend endpoints", async () => {
  let called = false;
  const proxy = gateway(() => { called = true; });
  for (const segments of [["..", "secret"], ["data", "pg_authid"], ["auth", "me", "extra"], ["catalog", "products"]]) {
    assert.equal((await proxy(new Request("http://localhost:3000/api/backend/x"), segments)).status, 404);
  }
  assert.equal(called, false);
});

test("forwards only session cookie and real Origin; keeps response cookie HttpOnly", async () => {
  const proxy = gateway(async (url, options) => {
    assert.equal(String(url), "http://127.0.0.1:8000/api/auth/login");
    assert.equal(options.headers.get("Cookie"), "phub_session=old");
    assert.equal(options.headers.get("Origin"), "http://localhost:3000");
    assert.equal(options.headers.get("Authorization"), null);
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return Response.json({ role: "ADMIN" }, { headers: { "Set-Cookie": "phub_session=new; HttpOnly; SameSite=Lax; Path=/" } });
  });
  const response = await proxy(new Request("http://localhost:3000/api/backend/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: "another=private; phub_session=old", Authorization: "never-forward" },
    body: JSON.stringify({ username: "admin", password: "test-only" }),
  }), ["auth", "login"]);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { role: "ADMIN" });
});

test("keeps encoded composite keys and safe upstream failures", async () => {
  const query = "?key=" + encodeURIComponent('[1,"CPU-001"]');
  const proxy = gateway(async url => {
    assert.equal(url.searchParams.get("key"), '[1,"CPU-001"]');
    return Response.json({ detail: "Bạn không có quyền." }, { status: 403 });
  });
  const response = await proxy(new Request("http://localhost:3002/api/backend/data/inventory" + query), ["data", "inventory"]);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { detail: "Bạn không có quyền." });
});

test("logout has no body and forwards expired cookie", async () => {
  const proxy = gateway(async () => new Response(null, { status: 204, headers: { "Set-Cookie": "phub_session=; Max-Age=0; Path=/" } }));
  const response = await proxy(new Request("http://localhost:3000/api/backend/auth/logout", { method: "POST" }), ["auth", "logout"]);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("missing backend is a safe 503 without secret/error leakage", async () => {
  const proxy = gateway(async () => { throw new Error("internal credentials must not escape"); });
  const response = await proxy(new Request("http://localhost:3000/api/backend/auth/me"), ["auth", "me"]);
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("internal credentials"), false);
});

test("oversized body and unsupported backend scheme are rejected", async () => {
  let called = false;
  const proxy = gateway(async () => { called = true; });
  const response = await proxy(new Request("http://localhost:3000/api/backend/auth/login", { method: "POST", body: "x".repeat(1_048_577) }), ["auth", "login"]);
  assert.equal(response.status, 413);
  assert.equal(called, false);
  const invalid = gateway(async () => { called = true; }, { PHUB_API_BASE_URL: "file:///private" });
  assert.equal((await invalid(new Request("http://localhost:3000/api/backend/auth/me"), ["auth", "me"])).status, 503);
  assert.equal(called, false);
});

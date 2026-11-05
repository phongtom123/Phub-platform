const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const diagnosticCode = compile("../src/lib/local-diagnostics.ts");
const routeCode = compile("../app/images/[...path]/route.ts");
function load(fetch, env = "development") {
  const logs = [];
  const common = { URL, Request, Response, Headers, AbortSignal, Error, Uint8Array,
    process: { env: { NODE_ENV: env } }, console: { warn: (...args) => logs.push(args) } };
  const diagnostics = { ...common, exports: {} };
  vm.runInNewContext(diagnosticCode, diagnostics);
  const route = { ...common, exports: {}, fetch, require: () => diagnostics.exports };
  vm.runInNewContext(routeCode, route);
  return { diagnostics: diagnostics.exports, logs, get: segments => route.exports.GET(
    new Request("http://localhost:3000/images/test.png?token=do-not-forward", {
      headers: { Cookie: "phub_session=secret", Authorization: "Bearer secret" },
    }), { params: Promise.resolve({ path: segments }) }) };
}

test("legacy paths fetch only the fixed public Storage prefix, with no credential/query forwarding", async () => {
  let calls = 0;
  const app = load(async (url, options) => {
    calls++;
    assert.equal(url, "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/figma-mobile/catalog-product-08.png");
    assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error");
    assert.deepEqual(Object.keys(options.headers), ["Accept"]);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
  });
  const response = await app.get(["figma-mobile", "catalog-product-08.png"]);
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control"), /max-age=3600/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  assert.equal(calls, 1); assert.equal(app.logs.length, 0);
});

test("traversal, control/encoded paths, arbitrary URL and non-image files never reach Storage", async () => {
  const app = load(() => { throw new Error("Must not fetch"); });
  for (const segments of [[], ["..", "test.png"], ["a/b.png"], ["a\\b.png"], ["%2e%2e", "a.png"],
    ["https://evil.test/a.png"], ["a\n.png"], ["package.json"], ["a.svg"], ["x".repeat(256) + ".png"]]) {
    const response = await app.get(segments);
    assert.equal(response.status, 404); assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("upstream status, type, empty/oversized stream and timeout have distinct safe diagnostics", async () => {
  const timeout = new Error("private upstream URL/password must not be logged"); timeout.name = "TimeoutError";
  for (const [fetch, status, reason] of [
    [async () => new Response("missing", { status: 404 }), 404, "upstream-404"],
    [async () => new Response("private error", { status: 403 }), 502, "upstream-403"],
    [async () => new Response("private error", { status: 503 }), 502, "upstream-503"],
    [async () => new Response("html", { headers: { "Content-Type": "text/html" } }), 502, "invalid-content-type"],
    [async () => new Response(null, { headers: { "Content-Type": "image/png" } }), 502, "empty-image"],
    [async () => new Response(new Uint8Array(), { headers: { "Content-Type": "image/png" } }), 502, "empty-image"],
    [async () => new Response("x", { headers: { "Content-Type": "image/png", "Content-Length": "10485761" } }), 502, "image-too-large"],
    [async () => new Response(new Uint8Array(10485761), { headers: { "Content-Type": "image/png" } }), 502, "image-too-large"],
    [async () => { throw timeout; }, 504, "upstream-timeout"],
    [async () => { throw new Error("secret network error"); }, 502, "upstream-unavailable"],
  ]) {
    const app = load(fetch);
    const response = await app.get(["test.png"]);
    assert.equal(response.status, status); assert.equal(response.headers.get("x-phub-media-error"), reason);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(app.logs.length, 1); assert.equal(app.logs[0][1].reason, reason);
    assert.doesNotMatch(JSON.stringify(app.logs), /private|password|secret|token=/);
  }
});

test("image logs strip query, fragment, userinfo and blob IDs; disabled outside development", () => {
  const source = "https://username:password@media.test/photo.png?token=secret#private";
  const app = load(() => {});
  assert.equal(app.diagnostics.diagnosticImageUrl(source), "https://media.test/photo.png");
  assert.equal(app.diagnostics.diagnosticImageUrl("/images/test.png?token=secret"), "/images/test.png");
  assert.equal(app.diagnostics.diagnosticImageUrl("blob:http://localhost/secret-uuid"), "[local-file-preview]");
  assert.equal(app.diagnostics.diagnosticImageUrl("javascript:alert(1)"), "[unsupported-image-url]");
  app.diagnostics.logLocalImageFailure(source, "preview");
  assert.equal(app.logs.length, 1); assert.doesNotMatch(JSON.stringify(app.logs), /password|secret|username|private/);
  for (const env of ["production", "test"]) {
    const quiet = load(() => {}, env);
    quiet.diagnostics.logLocalImageFailure(source, "preview"); assert.equal(quiet.logs.length, 0);
  }
});

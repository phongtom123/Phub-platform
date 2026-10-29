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

test("admin operations preserve idempotency and cannot open arbitrary methods or resources", async () => {
  const calls=[];
  const proxy=gateway(async(url,options)=>{calls.push({url:String(url),method:options.method,key:options.headers.get("Idempotency-Key"),body:options.body});return Response.json({data:[{}],replayed:false});});
  const body=JSON.stringify({action:"confirm",record_id:"DH1",data:{}}),key="a77a9370-caa8-48d8-a3dc-60f352cedee1";
  for(let i=0;i<2;i++)assert.equal((await proxy(new Request("http://localhost/x",{method:"POST",headers:{Origin:"http://localhost:3000","Idempotency-Key":key},body}),["admin","operations","orders"])).status,200);
  assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].key,key);assert.equal(calls[0].body,body);
  for(const segments of [["admin","operations","transfers"],["admin","operations","accounts"],["admin","operations","read","passwords"],["admin","operations","orders","delete"]])assert.equal((await proxy(new Request("http://localhost/x",{method:"POST",body}),segments)).status,404);
  assert.equal((await proxy(new Request("http://localhost/x",{method:"PATCH",body}),["admin","operations","orders"])).status,404);
});

function gateway(fetch, env = {}) {
  const sandbox = { exports: {}, process: { env }, URL, Request, Response, Headers, TextEncoder, AbortSignal, fetch };
  vm.runInNewContext(code, sandbox);
  return (request, segments) => sandbox.exports.proxyBackend(request, { params: Promise.resolve({ path: segments }) });
}

test("warehouse gateway permits scoped receipt/history operations and rejects arbitrary actions", async () => {
  const calls=[];
  const proxy=gateway(async(url,options)=>{calls.push({url:String(url),key:options.headers.get('Idempotency-Key'),origin:options.headers.get('Origin')});return Response.json({});});
  const key='a77a9370-caa8-48d8-a3dc-60f352cedee1';
  for(const [method,segments] of [['GET',['warehouse','receipts']],['GET',['warehouse','history']],['POST',['warehouse','receipts']],['GET',['warehouse','receipts','-5']],['PATCH',['warehouse','receipts','0']],['POST',['warehouse','receipts','2','confirm']],['POST',['warehouse','receipts','2','cancel']]]) {
    assert.equal((await proxy(new Request('http://localhost/x',{method,headers:{Origin:'http://localhost:3002','Idempotency-Key':key}}),segments)).status,200);
  }
  assert.ok(calls.every(call=>call.key===key&&call.origin==='http://localhost:3002'));
  for(const [method,segments] of [['DELETE',['warehouse','receipts','1']],['POST',['warehouse','receipts','1','dispatch']],['PATCH',['warehouse','inventory']],['GET',['warehouse','receipts','2147483648']],['GET',['warehouse','receipts','../1']],['GET',['warehouse','receipts','1','confirm']]]) {
    assert.equal((await proxy(new Request('http://localhost/x',{method}),segments)).status,404);
  }
});

test("staff handoff forwards issuance with the source cookie, keeping exchange server-only", async () => {
  const calls=[];
  const proxy=gateway(async(url,options)=>{calls.push({url:String(url),cookie:options.headers.get('Cookie'),origin:options.headers.get('Origin'),body:options.body});return Response.json({code:'A'.repeat(43),expires_in:60});});
  const body=JSON.stringify({target_origin:'https://warehouse.example.test'});
  const request=new Request('https://admin.example.test/api/backend/auth/handoff',{method:'POST',headers:{Origin:'https://admin.example.test',Cookie:'phub_session=fixture'},body});
  assert.equal((await proxy(request,['auth','handoff'])).status,200);
  assert.equal(calls.length,1);
  assert.equal(calls[0].cookie,'phub_session=fixture');
  assert.equal(calls[0].origin,'https://admin.example.test');
  assert.equal(calls[0].body,body);
  assert.equal((await proxy(request,['auth','handoff','exchange'])).status,404);
});

test("product gallery gateway forwards only GET/PUT and rejects traversal and arbitrary media paths", async () => {
  const calls=[];
  const proxy=gateway(async(url,options)=>{calls.push({url:String(url),method:options.method,body:options.body});return Response.json({images:[]});});
  for(const method of ['GET','PUT']) {
    const response=await proxy(new Request('http://localhost/x',{method,...(method==='PUT'?{body:'{"items":[]}'}:{})}),['admin','media','products','SP1','images']);
    assert.equal(response.status,200);
  }
  assert.equal(calls.length,2); assert.equal(calls[1].body,'{"items":[]}');
  for(const method of ['POST','DELETE','PATCH'])assert.equal((await proxy(new Request('http://localhost/x',{method}),['admin','media','products','SP1','images'])).status,404);
  for(const id of ['..','%2e%2e','SP/1','SP\\1'])assert.equal((await proxy(new Request('http://localhost/x'),['admin','media','products',id,'images'])).status,404);
  assert.equal(calls.length,2);
});

test("gallery product IDs preserve spaces, Vietnamese and URL punctuation through GET/PUT", async () => {
  const calls=[];
  const proxy=gateway(async(url,options)=>{
    calls.push({url:new URL(url),method:options.method,body:options.body});
    return Response.json({images:[]});
  });
  const ids=['SP 001','Sản phẩm 01','SP #1?code=2%+','Ắ'.repeat(200)];
  for(const id of ids) for(const method of ['GET','PUT']) {
    const body=JSON.stringify({items:[],expected_ids:[],expected_legacy_url:null});
    const request=new Request('http://localhost/x?keep=1',{method,...(method==='PUT'?{body}:{})});
    assert.equal((await proxy(request,['admin','media','products',id,'images'])).status,200);
    const sent=calls.at(-1);
    assert.equal(decodeURIComponent(sent.url.pathname.split('/')[5]),id);
    assert.equal(sent.url.search,'?keep=1');
    assert.equal(sent.url.hash,'');
    assert.equal(sent.method,method);
    if(method==='PUT') assert.equal(sent.body,body);
  }
  const before=calls.length;
  for(const id of ['', ' ', '.', '..', '%2e%2e', '.%2E', 'SP/1', 'SP\\1', 'SP\n1', 'SP\u00001', 'A'.repeat(201)]) {
    assert.equal((await proxy(new Request('http://localhost/x'),['admin','media','products',id,'images'])).status,404);
  }
  assert.equal(calls.length,before,'invalid IDs must not reach the backend');
});

test("draft header gateway forwards only receipt edits; transfers stay disabled", async () => {
  const calls=[];
  const proxy=gateway(async(url,options)=>{calls.push({url:String(url),method:options.method,origin:options.headers.get("Origin")});return Response.json({data:[]});});
  for(const resource of ["receipts"]){
    assert.equal((await proxy(new Request("http://localhost:3000/api/backend/x?key=%5B-5%5D",{method:"PATCH",headers:{Origin:"http://localhost:3000"},body:'{"ghi_chu":"test"}'}),["admin","warehouse-drafts",resource])).status,200);
  }
  assert.equal(calls.length,1);assert.ok(calls.every(call=>call.method==="PATCH"&&call.url.endsWith("?key=%5B-5%5D")&&call.origin==="http://localhost:3000"));
  for(const [method,resource] of [["POST","receipts"],["DELETE","transfers"],["PATCH","transfers"],["GET","receipts"],["PATCH","inventory"]]){
    assert.equal((await proxy(new Request("http://localhost/x",{method}),["admin","warehouse-drafts",resource])).status,404);
  }
  assert.equal(calls.length,1);
});

test("CRM profile and scoped orders pass the gateway; other CRM paths/methods stay closed", async () => {
  const calls = [];
  const proxy = gateway(async (url, options) => {
    calls.push({ url: String(url), method: options.method, origin: options.headers.get("Origin"), cookie: options.headers.get("Cookie") });
    return Response.json({ ok: true });
  });
  for (const [method, segments] of [
    ["GET", ["crm", "customers", "KH_123"]],
    ["PATCH", ["crm", "customers", "KH_123"]],
    ["GET", ["crm", "customers", "KH_123", "orders"]],
  ]) {
    const request = new Request("http://localhost:3000/api/backend/x?page=2", { method,
      headers: { Origin: "http://localhost:3000", Cookie: "other=hidden; phub_session=test" },
      ...(method === "PATCH" ? { body: JSON.stringify({ ngay_sinh: "2000-02-29" }) } : {}),
    });
    assert.equal((await proxy(request, segments)).status, 200);
  }
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "http://127.0.0.1:8000/api/crm/customers/KH_123?page=2");
  assert.equal(calls[1].origin, "http://localhost:3000");
  assert.equal(calls[1].cookie, "phub_session=test");
  for (const [method, segments] of [
    ["DELETE", ["crm", "customers", "KH_123"]], ["POST", ["crm", "customers", "KH_123", "orders"]],
    ["GET", ["crm", "customers", ".."]], ["GET", ["crm", "customers", "KH/secret"]],
    ["GET", ["crm", "customers", "%2e%2e"]], ["GET", ["crm", "customers", "KH1", "secret"]],
  ]) assert.equal((await proxy(new Request("http://localhost/x", { method }), segments)).status, 404);
  assert.equal(calls.length, 3);
});

test("support gateway permits only the admin inbox/read/update and customer create/own-read contracts", async () => {
  const calls = [];
  const proxy = gateway(async (url, options) => { calls.push([String(url), options.method]); return Response.json({}); });
  const id = 'a1111111-1111-4111-8111-111111111111';
  for (const [method, parts] of [
    ['GET', ['crm','feedback']], ['GET',['crm','feedback',id]], ['PATCH',['crm','feedback',id]],
    ['GET',['customer','crm','feedback']], ['POST',['customer','crm','feedback']], ['GET',['customer','crm','feedback',id]],
  ]) {
    assert.equal((await proxy(new Request('http://localhost/api/backend/x', {method}), parts)).status, 200);
  }
  assert.equal(calls.length, 6);
  for (const [method, parts] of [
    ['POST',['crm','feedback']], ['DELETE',['crm','feedback',id]], ['PATCH',['customer','crm','feedback',id]],
    ['GET',['crm','feedback','..']], ['GET',['crm','feedback','%2e%2e']], ['GET',['crm','feedback',id,'secret']],
  ]) assert.equal((await proxy(new Request('http://localhost/api/backend/x', {method}), parts)).status, 404);
  assert.equal(calls.length, 6);
});

test("media upload forwards binary bytes, content type and only the session cookie", async () => {
  const bytes = Uint8Array.from([137, 80, 78, 71, 0, 255, 128, 1]);
  const proxy = gateway(async (url, options) => {
    assert.equal(url.pathname, "/api/admin/media/images");
    assert.equal(options.headers.get("Content-Type"), "image/png");
    assert.equal(options.headers.get("Origin"), "http://localhost:3000");
    assert.equal(options.headers.get("Cookie"), "phub_session=test");
    assert.equal(options.headers.get("Authorization"), null);
    assert.deepEqual(Buffer.from(options.body), Buffer.from(bytes));
    return Response.json({ url: "https://example.test/image.webp" }, { status: 201 });
  });
  const response = await proxy(new Request("http://localhost:3000/api/backend/admin/media/images", {
    method: "POST", headers: { "Content-Type": "image/png", Origin: "http://localhost:3000", Cookie: "other=secret; phub_session=test" }, body: bytes,
  }), ["admin", "media", "images"]);
  assert.equal(response.status, 201);
});

test("media rejects unsupported types, excessive bodies and arbitrary methods/paths before forwarding", async () => {
  let calls = 0;
  const proxy = gateway(async () => { calls++; return Response.json({}); });
  for (const type of ["application/json", "image/svg+xml", "text/html", "multipart/form-data"]) {
    const request = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Type": type }, body: "fake" });
    assert.equal((await proxy(request, ["admin", "media", "images"])).status, 415);
  }
  const oversized = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Type": "image/png" }, body: new Uint8Array(5 * 1024 * 1024 + 1) });
  assert.equal((await proxy(oversized, ["admin", "media", "images"])).status, 413);
  for (const [method, parts] of [["GET", ["admin", "media", "images"]], ["DELETE", ["admin", "media", "images"]], ["POST", ["admin", "media", "images", "extra"]]]) {
    assert.equal((await proxy(new Request("http://localhost/upload", { method }), parts)).status, 404);
  }
  assert.equal(calls, 0);
});

test("allowlist rejects traversal and arbitrary backend endpoints", async () => {
  let called = false;
  const proxy = gateway(() => { called = true; });
  for (const segments of [["..", "secret"], ["data", "pg_authid"], ["auth", "me", "extra"], ["catalog", "products"]]) {
    assert.equal((await proxy(new Request("http://localhost:3000/api/backend/x"), segments)).status, 404);
  }
  for (const [method, segments] of [
    ["GET", ["auth", "login"]], ["GET", ["auth", "register"]],
    ["POST", ["auth", "me"]], ["GET", ["auth", "logout"]],
  ]) assert.equal((await proxy(new Request("http://localhost:3000/api/backend/x", { method }), segments)).status, 404);
  assert.equal(called, false);
});

test("registration is forwarded only through the server gateway", async () => {
  const proxy = gateway(async (url, options) => {
    assert.equal(String(url), "http://127.0.0.1:8000/api/auth/register");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Origin"), "http://localhost:3001");
    assert.equal(options.headers.get("Authorization"), null);
    return Response.json({ role: "KHACH_HANG" }, { status: 201 });
  });
  const response = await proxy(new Request("http://localhost:3001/api/backend/auth/register", {
    method: "POST", headers: { Origin: "http://localhost:3001" },
    body: JSON.stringify({ username: "customer", password: "customer-password" }),
  }), ["auth", "register"]);
  assert.equal(response.status, 201);
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

test("admin account routes forward the correct method, query and JSON body", async () => {
  const operations = [
    ["GET", ["admin", "accounts"]], ["POST", ["admin", "accounts"]],
    ["GET", ["admin", "account-owners"]], ["GET", ["admin", "accounts", "TK_001"]],
    ["PATCH", ["admin", "accounts", "TK_001"]], ["POST", ["admin", "accounts", "TK_001", "status"]],
    ["POST", ["admin", "accounts", "TK_001", "password"]], ["PUT", ["admin", "accounts", "TK_001", "role"]],
    ["GET", ["admin", "me"]], ["PATCH", ["admin", "me"]], ["POST", ["admin", "me", "password"]],
  ];
  for (const [method, segments] of operations) {
    const proxy = gateway(async (url, options) => {
      assert.equal(String(url), "https://api.example.test/api/" + segments.join("/") + "?page=2&role=ADMIN");
      assert.equal(options.method, method);
      assert.equal(options.headers.get("Cookie"), "phub_session=test");
      if (method !== "GET") {
        assert.equal(options.headers.get("Content-Type"), "application/json");
        assert.deepEqual(JSON.parse(options.body), { test: true });
        assert.equal(options.headers.get("Origin"), "https://admin.example.test");
      }
      return Response.json({ ok: true });
    }, { PHUB_API_BASE_URL: "https://api.example.test" });
    const response = await proxy(new Request("https://admin.example.test/api/backend/x?page=2&role=ADMIN", {
      method, headers: { Cookie: "phub_session=test", Origin: "https://admin.example.test" },
      ...(method !== "GET" ? { body: JSON.stringify({ test: true }) } : {}),
    }), segments);
    assert.equal(response.status, 200);
  }
});

test("admin gateway rejects wrong verbs, arbitrary actions and encoded traversal", async () => {
  let calls = 0;
  const proxy = gateway(async () => { calls++; return Response.json({}); });
  for (const segments of [
    ["admin", "accounts", ".."], ["admin", "accounts", "."], ["admin", "accounts", "%2e%2e"],
    ["admin", "accounts", "a/b"], ["admin", "accounts", "a%2fb"],
    ["admin", "accounts", "TK1", "delete"], ["admin", "me", "role"],
  ]) assert.equal((await proxy(new Request("http://localhost:3000/api/backend/x"), segments)).status, 404);
  for (const [method, segments] of [
    ["DELETE", ["admin", "accounts", "TK1"]], ["PUT", ["admin", "accounts", "TK1"]],
    ["GET", ["admin", "me", "password"]], ["PATCH", ["admin", "accounts", "TK1", "role"]],
    ["POST", ["admin", "account-owners"]],
  ]) assert.equal((await proxy(new Request("http://localhost:3000/api/backend/x", { method }), segments)).status, 404);
  assert.equal(calls, 0);
});

test("customer gateway exposes only authenticated commerce contracts", async () => {
  const allowed = [
    ["GET", ["customer", "me"]], ["PUT", ["customer", "me"]],
    ["POST", ["customer", "checkout", "quote"]],
    ["GET", ["customer", "orders"]], ["POST", ["customer", "orders"]],
    ["GET", ["customer", "orders", "ORDER-1"]],
    ["GET", ["customer", "orders", "ORDER-1", "invoice"]],
    ["POST", ["orders"]], ["GET", ["orders", "ORDER-1", "payments"]],
    ["GET", ["orders", "ORDER-1", "transactions"]],
    ["POST", ["orders", "ORDER-1", "payment-request"]],
  ];
  for (const [method, segments] of allowed) {
    const proxy = gateway(async () => Response.json({ ok: true }));
    assert.equal((await proxy(new Request("http://localhost:3001/api/backend/x", { method }), segments)).status, 200);
  }

  let calls = 0;
  const proxy = gateway(async () => { calls++; return Response.json({}); });
  for (const [method, segments] of [
    ["DELETE", ["customer", "me"]], ["GET", ["customer", "checkout", "quote"]],
    ["GET", ["customer", "orders", ".."]], ["POST", ["customer", "orders", "ORDER-1"]],
    ["GET", ["orders", "ORDER-1", "payment-request"]], ["GET", ["orders", "ORDER-1", "private"]],
  ]) assert.equal((await proxy(new Request("http://localhost:3001/api/backend/x", { method }), segments)).status, 404);
  assert.equal(calls, 0);
});

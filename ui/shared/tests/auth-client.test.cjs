const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../../adminUI/node_modules/typescript");

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../auth-client.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function authClient(fetch) {
  const sandbox = { exports: {}, fetch, Response, Headers, AbortSignal };
  vm.runInNewContext(code, sandbox);
  return sandbox.exports;
}

const session = {
  account_id: "TK1", username: "admin", role: "ADMIN", name: "Admin",
  customer_id: null, employee_id: "NV1", warehouse_id: null,
};

test("login uses the shared gateway and keeps JWT handling in HttpOnly cookies", async () => {
  const client = authClient(async (url, options) => {
    assert.equal(url, "/api/backend/auth/login");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(options.body), { username: "admin", password: "secret" });
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(session);
  });
  assert.deepEqual(await client.loginSession(" admin ", "secret"), session);
});

test("customer registration normalizes public fields and never sends password confirmation", async () => {
  const customer = { ...session, role: "KHACH_HANG", customer_id: "KH1", employee_id: null };
  const client = authClient(async (url, options) => {
    assert.equal(url, "/api/backend/auth/register");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(options.body), {
      name: "Customer Name", username: "customer", email: "customer@example.com",
      phone: null, password: "customer-password",
    });
    return Response.json(customer, { status: 201 });
  });
  assert.deepEqual(await client.registerCustomer({
    name: " Customer Name ", username: " customer ", email: " CUSTOMER@EXAMPLE.COM ",
    phone: " ", password: "customer-password",
  }), customer);
});

test("session validation rejects malformed responses", async () => {
  const client = authClient(async () => Response.json({ role: "ROOT" }));
  await assert.rejects(client.getSession(), error => error.status === 502);
});

test("backend auth errors keep their status and safe message", async () => {
  const client = authClient(async () => Response.json({ detail: "Vui lòng đăng nhập." }, { status: 401 }));
  await assert.rejects(client.getSession(), error => error.status === 401 && error.message === "Vui lòng đăng nhập.");
});

test("logout uses the same gateway and no token is exposed to JavaScript", async () => {
  const client = authClient(async (url, options) => {
    assert.equal(url, "/api/backend/auth/logout");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    return new Response(null, { status: 204 });
  });
  await client.logoutSession();
});

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
  }).then(value => JSON.parse(JSON.stringify(value))), { ...customer, linked_orders: 0 });
});

test("registration reports walk-in orders linked by email and ignores invalid counts", async () => {
  const customer = { ...session, role: "KHACH_HANG", customer_id: "KH1", employee_id: null };
  for (const [value, expected] of [[2, 2], [0, 0], [-1, 0], [1.5, 0], ["2", 0]]) {
    const client = authClient(async () => Response.json({ ...customer, linked_orders: value }, { status: 201 }));
    const result = await client.registerCustomer({ name: "Khách", username: "khach", email: "khach@example.com", password: "mat-khau-dai" });
    assert.equal(result.linked_orders, expected);
  }
});

test("session validation rejects malformed responses", async () => {
  const client = authClient(async () => Response.json({ role: "ROOT" }));
  await assert.rejects(client.getSession(), error => error.status === 502);
});

test("backend auth errors keep their status and safe message", async () => {
  const client = authClient(async () => Response.json({ detail: "Vui lòng đăng nhập." }, { status: 401 }));
  await assert.rejects(client.getSession(), error => error.status === 401 && error.message === "Vui lòng đăng nhập.");
});

const registration = { name: "Khách", username: "khach", email: "khach@example.com", phone: "", password: "mat-khau-dai" };

test("registration shows each field error in Vietnamese instead of a session error", async () => {
  const client = authClient(async () => Response.json({ detail: [
    { loc: ["body", "email"], msg: "Value error, Email không đúng định dạng.", type: "value_error" },
    { loc: ["body", "phone"], msg: "Value error, Số điện thoại không đúng định dạng.", type: "value_error" },
    { loc: ["body", "password"], msg: "String should have at least 10 characters", type: "string_too_short" },
  ] }, { status: 422 }));
  await assert.rejects(client.registerCustomer(registration), error => error.status === 422 &&
    error.message === "Email không đúng định dạng. Số điện thoại không đúng định dạng. Mật khẩu cần ít nhất 10 ký tự.");
});

test("registration keeps the backend conflict text and has its own fallback", async () => {
  const conflict = authClient(async () => Response.json({ detail: "Tên tài khoản đã được sử dụng. Vui lòng chọn tên khác." }, { status: 409 }));
  await assert.rejects(conflict.registerCustomer(registration),
    error => error.status === 409 && error.message === "Tên tài khoản đã được sử dụng. Vui lòng chọn tên khác.");
  const unknown = authClient(async () => new Response("upstream down", { status: 502 }));
  await assert.rejects(unknown.registerCustomer(registration),
    error => error.message === "Không tạo được tài khoản. Kiểm tra lại thông tin và thử lại.");
  const session = authClient(async () => Response.json({ detail: [{ loc: ["header"], msg: "x" }] }, { status: 401 }));
  await assert.rejects(session.getSession(), error => error.message === "Không xác thực được phiên đăng nhập.");
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

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/account/client.ts"), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function client(fetch = () => { throw new Error("Unexpected network call"); }) {
  const scope = { exports: {}, fetch, Intl }; vm.runInNewContext(code, scope); return scope.exports;
}
const profile = { customer_id: "KH-TEST", name: "Test", phone: null, address_line: null, province: null, ward: null };
const order = { id: "ORDER-1", status: "MOI", created_at: "2026-10-14T00:00:00Z", currency: "VND", total: "120000.00" };
const pagination = { page: 1, page_size: 10, total: 25, total_pages: 3 };
const transaction = { type: "refund", method: "bank_transfer", amount: "120000.00", status: "pending", occurred_at: null, message: "Pending refund" };

test("customer requests use same-origin cookie gateway, no caching and abort signal", async () => {
  const signal = new AbortController().signal;
  const api = client(async (url, init) => {
    assert.equal(url, "/api/backend/customer/me");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.signal, signal);
    assert.equal(init.headers, undefined);
    return Response.json(profile);
  });
  assert.deepEqual(await api.accountRequest("customer/me", api.parseProfile, { signal }), profile);
});
test("PUT passes only supplied recipient values and preserves backend validation errors", async () => {
  const api = client(async (url, options) => {
    assert.equal(options.method, "PUT");
    return Response.json({ error: { message: "Invalid phone" } }, { status: 422 });
  });
  await assert.rejects(api.accountRequest("customer/me", api.parseProfile, { method: "PUT" }), e => e.status === 422 && e.message === "Invalid phone");
});
for (const status of [401, 403, 404, 503]) {
  test(`preserves HTTP ${status} without manufacturing empty data`, async () => {
    const api = client(async () => Response.json({ error: { message: "Unavailable" } }, { status }));
    await assert.rejects(api.accountRequest("customer/me", api.parseProfile), e => e.status === status);
  });
}
test("invalid JSON and malformed success become 502, not a fake account", async () => {
  for (const response of [new Response("not JSON"), Response.json({ name: "Test" })]) {
    const api = client(async () => response);
    await assert.rejects(api.accountRequest("customer/me", api.parseProfile), e => e.status === 502);
  }
});
test("null profile fields remain missing; pagination preserves total across all pages", () => {
  const api = client();
  assert.equal(api.parseProfile(profile), profile);
  const result = api.parseOrders({ items: [order], pagination });
  assert.equal(result.pagination.total, 25);
  for (const invalid of [{ items: [order], pagination: { ...pagination, total: -1 } }, { items: [{ ...order, total: "NaN" }], pagination }, { items: [{ ...order, created_at: "bad" }], pagination }]) assert.throws(() => api.parseOrders(invalid));
});
test("empty invoice/payment are explicit null; refund pending is not converted to paid", () => {
  const api = client();
  assert.equal(api.parseInvoice({ order_id: order.id, currency: "VND", invoice: null, items: [] }).invoice, null);
  assert.equal(api.parsePayment({ order_id: order.id, currency: "VND", latest_transaction: null, message: "None" }).latest_transaction, null);
  const result = api.parseTransactions({ order_id: order.id, currency: "VND", items: [transaction], pagination });
  assert.equal(result.items[0].type, "refund"); assert.equal(result.items[0].status, "pending");
  assert.throws(() => api.parseTransactions({ ...result, items: [{ ...transaction, amount: "-1" }] }));
  assert.throws(() => api.parseInvoice({ order_id: order.id, currency: "VND", items: [] }));
});
test("order details require valid recipient, quantities and stored line amounts", () => {
  const api = client();
  const line = { sku: "SKU", name: "Product", unit: "Cái", quantity: 1, unit_price: "120000.00", discount: "0.00", tax_amount: "0.00", line_total: "120000.00" };
  const detail = { ...order, recipient: { name: "Test", phone: null, address_line: null, province: null, ward: null }, note: null, items: [line] };
  assert.equal(api.parseOrder(detail), detail);
  assert.throws(() => api.parseOrder({ ...detail, items: [{ ...line, quantity: 0 }] }));
});

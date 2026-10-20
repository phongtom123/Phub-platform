const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/data-navigation.ts"), "utf8");
const sandbox = { exports: {}, URLSearchParams };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const { dataHref, dataBreadcrumbs } = sandbox.exports;
const crumbs = (...args) => JSON.parse(JSON.stringify(dataBreadcrumbs(...args)));

test("list, signed/composite detail, create and edit breadcrumbs all have links", () => {
  assert.deepEqual(crumbs("orders", "").map(c => c.label), ["Quản trị", "Đơn hàng"]);
  for (const resource of ["warehouses", "inventory", "products"]) {
    const key = JSON.stringify(resource === "inventory" ? [-900003, "SKU-1"] : [-900003]);
    for (const mode of ["", "&edit=1", "&new=1"]) {
      const items = crumbs(resource, "?key=" + encodeURIComponent(key) + mode);
      assert.ok(items.every(c => c.href.startsWith("/")));
      assert.equal(new URL(items[2].href, "http://test").searchParams.get("key"), key);
    }
  }
});

test("order context survives list/detail/edit and has a real parent order link", () => {
  const orderId = "ORDER /?&1";
  for (const resource of ["order-lines", "invoices", "payments", "voucher-uses"]) {
    const href = dataHref(resource, { orderId, key: "[-5]", edit: true });
    const url = new URL(href, "http://test");
    assert.equal(url.searchParams.get("order_id"), orderId);
    const items = crumbs(resource, url.search);
    assert.deepEqual(items.map(c => c.label).slice(0, 3), ["Quản trị", "Đơn hàng", orderId]);
    assert.deepEqual(JSON.parse(new URL(items[2].href, "http://test").searchParams.get("key")), [orderId]);
    for (const item of items.slice(3)) assert.equal(new URL(item.href, "http://test").searchParams.get("order_id"), orderId);
  }
});

test("malformed keys and irrelevant order context do not crash or fabricate breadcrumbs", () => {
  assert.equal(crumbs("warehouses", "?key=invalid&order_id=ORDER-1")[2].label, "Chi tiết");
  assert.deepEqual(crumbs("products", "?order_id=ORDER-1").map(c => c.label), ["Quản trị", "Sản phẩm"]);
});

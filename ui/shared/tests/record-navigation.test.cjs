// Run: node --test ui/shared/tests/record-navigation.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../../adminUI/node_modules/typescript");

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../record-navigation.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(code, sandbox);
const { recordHref } = sandbox.exports;

test("signed PostgreSQL integer IDs survive detail and edit navigation", () => {
  for (const section of ["warehouses", "suppliers", "receipts", "transfers", "payments", "promotions", "vouchers", "order-lines", "voucher-uses"]) {
    for (const id of [-900003, -1, 0, 1, -2147483648, 2147483647]) {
      for (const edit of [false, true]) {
        const url = new URL(recordHref(section, String(id), edit), "http://localhost:3000");
        assert.equal(url.pathname, "/data/" + section);
        assert.deepEqual(JSON.parse(url.searchParams.get("key")), [id]);
        assert.equal(url.searchParams.get("edit"), edit ? "1" : null);
      }
    }
  }
});

test("invalid or out-of-range integer IDs cannot become detail keys", () => {
  for (const id of ["", " ", "abc", "true", "null", "1.5", "1e3", "0x10", "Infinity", "NaN", "2147483648", "-2147483649", "9007199254740993"]) {
    assert.equal(recordHref("warehouses", id), "/data/warehouses");
  }
});

test("aliases, string IDs, composite keys and create links keep their behavior", () => {
  const alias = new URL(recordHref("branches", "-900003"), "http://localhost:3000");
  assert.equal(alias.pathname, "/data/warehouses");
  assert.deepEqual(JSON.parse(alias.searchParams.get("key")), [-900003]);
  const order = new URL(recordHref("orders", "ORD-001", true), "http://localhost:3000");
  assert.deepEqual(JSON.parse(order.searchParams.get("key")), ["ORD-001"]);
  assert.equal(order.searchParams.get("edit"), "1");
  assert.equal(recordHref("billing", "INV-001").startsWith("/data/invoices?key="), true);
  for (const section of ["inventory", "receipt-lines", "transfer-lines"]) assert.equal(recordHref(section, "-900003"), "/data/" + section);
  assert.equal(recordHref("warehouses", "new"), "/data/warehouses?new=1");
  assert.equal(recordHref("unknown", "-900003"), null);
});

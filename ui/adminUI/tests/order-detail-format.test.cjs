const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const sandbox = { exports: {}, Intl, Date, Number, BigInt, String };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/features/orders/order-detail-format.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const { addOrderMoney, orderDate } = sandbox.exports;

test("order line discounts add exact decimal strings without float rounding", () => {
  assert.equal(addOrderMoney("9999999999999999.99", "0.01"), "10000000000000000.00");
  assert.equal(addOrderMoney("100", "2.5"), "102.50");
  for (const value of [null, 1, "-1", "1.234", "NaN", "1e3"]) {
    assert.equal(addOrderMoney(value, "0.00"), null);
  }
});

test("order dates use Vietnam time and reject fabricated invalid values", () => {
  for (const value of ["2026-11-04T01:02:03Z", "2026-11-04T08:02:03"]) {
    const rendered = orderDate(value);
    assert.ok(rendered.includes("04/11/2026"));
    assert.ok(rendered.includes("08:02:03"));
  }
  assert.equal(orderDate("not-a-date"), "Thời gian không hợp lệ");
  assert.equal(orderDate(null), "—");
});

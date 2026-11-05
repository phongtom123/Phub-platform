const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, `../src/lib/shopping/${name}.ts`), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const scope = { exports: {}, require: id => { assert.ok(id in dependencies); return dependencies[id]; } };
  vm.runInNewContext(code, scope);
  return scope.exports;
}
const { groupInvoiceLines } = load("invoice-lines", { "./money": load("money") });
const base = { sku: "PHONE-A", warehouse_id: 1, name: "Điện thoại Demo A", unit: "Chiếc", quantity: 1, unit_price: "5000000.00", discount: "0.00", tax_amount: "500000.00", line_total: "5500000.00" };

test("four warehouse allocations become one invoice product with 185 units", () => {
  const items = [37, 39, 60, 49].map((quantity, i) => ({ ...base, warehouse_id: i + 1, quantity, tax_amount: `${quantity * 500000}.00`, line_total: `${quantity * 5500000}.00` }));
  const before = JSON.stringify(items);
  const rows = groupInvoiceLines(items);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 185);
  assert.equal(rows[0].unit_price, "5000000.00");
  assert.equal(rows[0].tax_amount, "92500000.00");
  assert.equal(rows[0].line_total, "1017500000.00");
  assert.equal(JSON.stringify(items), before, "Source warehouse/order data is preserved");
});

test("sums stored discounts, tax and totals exactly, preserving per-warehouse rounding", () => {
  const rows = groupInvoiceLines([
    { ...base, unit_price: "0.05", discount: "0.00", tax_amount: "0.01", line_total: "0.06" },
    { ...base, warehouse_id: 2, unit_price: "0.05", discount: "0.01", tax_amount: "0.00", line_total: "0.04" },
    { ...base, warehouse_id: 3, unit_price: "0.05", discount: "0.00", tax_amount: "0.01", line_total: "0.06" },
  ]);
  assert.equal(rows[0].quantity, 3);
  assert.equal(rows[0].discount, "0.01");
  assert.equal(rows[0].tax_amount, "0.02");
  assert.equal(rows[0].line_total, "0.16");
});

test("keeps different SKUs and historical sale prices or units separate", () => {
  const rows = groupInvoiceLines([base, { ...base, sku: "PHONE-B" }, { ...base, unit_price: "4000000.00" }, { ...base, unit: "Hộp" }]);
  assert.equal(rows.length, 4);
  assert.equal(groupInvoiceLines([]).length, 0);
});

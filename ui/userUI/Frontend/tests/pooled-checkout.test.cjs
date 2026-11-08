const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(name, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../src/lib/shopping/${name}.ts`), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const scope = { exports: {}, require: id => { assert.ok(id in dependencies); return dependencies[id]; } };
  vm.runInNewContext(code, scope);
  return scope.exports;
}
const { validateQuote } = load("client", { "./money": load("money"), "./payment-deadline": load("payment-deadline") });
function quote() {
  return { currency: "VND", tax_application: "invoice", shipping_status: "not_quoted", voucher_code: null,
    items: [{ sku: "POOL", name: "Pooled product", unit: "unit", warehouse_id: 1, quantity: 165,
      allocations: [{ warehouse_id: 1, quantity: 18 }, { warehouse_id: 2, quantity: 39 }, { warehouse_id: 3, quantity: 60 }, { warehouse_id: 4, quantity: 48 }],
      unit_price: "100.00", gross_total: "16500.00", discount: "0.00", tax_rate: "10.00", tax_amount: "0.00", line_total: "16500.00" }],
    subtotal: "16500.00", discount_total: "0.00", tax_total: "0.00", total: "16500.00" };
}

test("accepts 165 units pooled across four warehouses as one checkout product", () => {
  const data = quote();
  assert.equal(validateQuote(data), data);
  assert.equal(data.items.length, 1);
});

for (const [name, allocations] of [
  ["insufficient allocation", [{ warehouse_id: 1, quantity: 164 }]],
  ["duplicate warehouse", [{ warehouse_id: 1, quantity: 100 }, { warehouse_id: 1, quantity: 65 }]],
  ["wrong first warehouse", [{ warehouse_id: 2, quantity: 165 }]],
  ["negative quantity", [{ warehouse_id: 1, quantity: -1 }, { warehouse_id: 2, quantity: 166 }]],
  ["fractional quantity", [{ warehouse_id: 1, quantity: 165.5 }]],
]) {
  test(`rejects ${name} before displaying checkout success`, () => {
    const data = quote();
    data.items[0].allocations = allocations;
    assert.throws(() => validateQuote(data), error => error.code === "INVALID_RESPONSE");
  });
}

test("retains compatibility with receipts created before pooled checkout", () => {
  const data = quote();
  delete data.items[0].allocations;
  assert.equal(validateQuote(data), data);
  data.items[0].allocations = [];
  assert.equal(validateQuote(data), data);
});

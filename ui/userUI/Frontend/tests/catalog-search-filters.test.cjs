const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
  const scope = { exports: {}, URLSearchParams, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, scope);
  return scope.exports;
}
const data = load("components/catalog/catalogData.ts");
const { queryFor } = load("lib/catalog/client.ts");
const { filtersFromParams, priceFilterError } = load("lib/catalog/filters.ts", { "@/components/catalog/catalogData": data });

test("filter query survives URL refresh and changing result pages or sort", () => {
  const filters = { ...data.emptyFilters, categories: ["CPU", "GPU"], subcategories: ["INTEL"], brand: "Example Brand", minPrice: "1000000.50", maxPrice: "9000000", stockStatus: "in-stock" };
  const request = { q: "  CPU i5  ", filters, sort: "price-asc", page: 1, pageSize: 20, view: "grid" };
  const query = queryFor(request);
  assert.equal(query.get("q"), "CPU i5");
  assert.deepEqual(query.getAll("category_id"), ["CPU", "GPU"]);
  assert.equal(query.get("min_price"), "1000000.50");
  assert.equal(query.get("max_price"), "9000000");
  assert.equal(query.get("stock_status"), "in-stock");
  const restored = filtersFromParams(query);
  assert.equal(JSON.stringify(restored), JSON.stringify({ ...data.emptyFilters, ...filters, color: "" }));
  const nextPage = queryFor({ ...request, filters: restored, page: 2, sort: "price-desc" });
  for (const key of ["min_price", "max_price", "brand", "stock_status"]) assert.equal(nextPage.get(key), query.get(key));
  assert.equal(nextPage.get("page"), "2");
});

test("supports filters without a keyword and clears them without dropping the keyword", () => {
  const request = { q: "", filters: { ...data.emptyFilters, stockStatus: "out-of-stock" }, sort: "position", page: 1, pageSize: 20, view: "grid" };
  assert.equal(queryFor(request).get("q"), null);
  assert.equal(queryFor(request).get("stock_status"), "out-of-stock");
  const cleared = queryFor({ ...request, q: "memory", filters: data.emptyFilters });
  assert.equal(cleared.get("q"), "memory");
  assert.equal(cleared.get("stock_status"), null);
  assert.equal(cleared.get("min_price"), null);
});

test("validates bounded monetary ranges precisely before sending a search", () => {
  for (const values of [{}, { minPrice: "0", maxPrice: "0" }, { minPrice: "9.99", maxPrice: "10.00" }]) assert.equal(priceFilterError({ ...data.emptyFilters, ...values }), "");
  for (const values of [{ minPrice: "-1" }, { maxPrice: "NaN" }, { minPrice: "1.234" }, { minPrice: "10000000000000000" }, { minPrice: "9999999999999999.99", maxPrice: "9999999999999999.98" }]) assert.ok(priceFilterError({ ...data.emptyFilters, ...values }));
});

test("spec selections survive refresh, pagination and special characters", () => {
  const filters = { ...data.emptyFilters, subcategories: ["DESKTOP_CUSTOM"], specs: { cpu: ['Intel "Core" & CPU', 'AMD Ryzen'], ram: ["32 GB"] } };
  const request = { q: "", filters, sort: "position", page: 1, pageSize: 20, view: "grid" };
  const query = queryFor(request);
  assert.equal(query.getAll("spec").length, 3);
  const restored = filtersFromParams(query);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.specs)), { cpu: ['AMD Ryzen', 'Intel "Core" & CPU'], ram: ["32 GB"] });
  const pageTwo = queryFor({ ...request, filters: restored, page: 2 });
  assert.deepEqual(pageTwo.getAll("spec"), query.getAll("spec"));
  assert.equal(pageTwo.get("subcategory_id"), "DESKTOP_CUSTOM");
  assert.doesNotThrow(() => filtersFromParams(new URLSearchParams({ spec: JSON.stringify(["toString", "safe"]) })));
});

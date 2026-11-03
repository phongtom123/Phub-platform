const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/customer-portal-url.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const scope = { exports: {}, URL };
vm.runInNewContext(code, scope);
const { customerPortalUrl } = scope.exports;

test("swapped local ports send customers from Admin 3001 to storefront 3000", () => {
  assert.equal(customerPortalUrl("http://localhost:3000", "http://localhost:3001/"), "http://localhost:3000/");
});
test("default local ports and separate production hosts remain supported", () => {
  assert.equal(customerPortalUrl("http://localhost:3001", "http://localhost:3000/accounts"), "http://localhost:3001/");
  assert.equal(customerPortalUrl("https://shop.example.test/", "https://admin.example.test/"), "https://shop.example.test/");
});
for (const current of ["http://localhost:3001/", "http://localhost:3001/accounts", "http://localhost:3001/?module=orders"]) {
  test(`prevents self redirect from ${current}`, () => {
    assert.throws(() => customerPortalUrl("http://localhost:3001", current), /Admin/);
  });
}
for (const target of ["not-a-url", "/", "javascript:alert(1)", "https://user:pass@shop.example.test/"]) {
  test(`rejects invalid destination ${target}`, () => {
    assert.throws(() => customerPortalUrl(target, "http://localhost:3001/"));
  });
}

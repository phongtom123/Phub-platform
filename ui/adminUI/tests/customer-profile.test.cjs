const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const sandbox = { exports: {}, Intl, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/customer-profile.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const { customerIdFromKey, customerAge, customerPatch, vietnamDate } = sandbox.exports;
const plain = value => JSON.parse(JSON.stringify(value));
test("customer key must contain exactly one nonempty string", () => {
  assert.equal(customerIdFromKey('["KH1"]'), "KH1");
  for (const key of ["", "broken", "[]", "[1]", '["KH1","KH2"]', '["  "]']) assert.equal(customerIdFromKey(key), null);
});
test("age uses birthday and Vietnam civil day, not the migration date", () => {
  assert.equal(customerAge(null, "2026-10-22"), null);
  assert.equal(customerAge("2000-10-23", "2026-10-22"), 25);
  assert.equal(customerAge("2000-10-22", "2026-10-22"), 26);
  assert.equal(customerAge("2999-01-01", "2026-10-22"), null);
  assert.equal(vietnamDate(new Date("2026-10-21T18:00:00Z")), "2026-10-22");
});
const draft = { ten_kh: "Khách", sdt: "09001", ngay_sinh: "", dia_chi_chi_tiet_md: "", tinh_thanh_md: "", xa_phuong_md: "" };
const data = { profile: { ...draft, ngay_sinh: null } };
test("patch sends dirty profile fields only, without the removed interest feature", () => {
  assert.deepEqual(plain(customerPatch(data, { ...draft, sdt: "09002" })), { sdt: "09002" });
  assert.deepEqual(plain(customerPatch(data, draft)), {});
  assert.deepEqual(plain(customerPatch(data, { ...draft, ngay_sinh: "2000-02-29" })), { ngay_sinh: "2000-02-29" });
  assert.throws(() => customerPatch(data, { ...draft, ten_kh: " " }), /Tên khách hàng/);
});

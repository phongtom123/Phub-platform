const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/inline-table-data.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const { inlinePatch, dataRowKey } = sandbox.exports;
const column = (name, options = {}) => ({ name, type: "varchar", required: false, ...options });
const patch = (...args) => JSON.parse(JSON.stringify(inlinePatch(...args, name => name)));

test("inline patches exclude keys/system/generated/immutable, trim only fields and preserve phone strings", () => {
  const columns = [column("ma_kh"), column("ten_kh", { required: true }), column("sdt"), column("created", { system: true }),
    column("generated", { generated: true }), column("immutable", { immutable: true })];
  const row = { ma_kh: "KH1", ten_kh: "Tên cũ", sdt: null };
  assert.deepEqual(patch(columns, ["ma_kh"], row, { ma_kh: "hacked", ten_kh: " Tên mới ", sdt: "0123456789", created: "x", generated: "x", immutable: "x" }),
    { ten_kh: "Tên mới", sdt: "0123456789" });
  assert.deepEqual(patch(columns, ["ma_kh"], row, { ten_kh: " Tên cũ ", sdt: " " }), {});
  assert.deepEqual(patch(columns, ["ma_kh"], { ...row, sdt: "" }, { ten_kh: "Tên khác", sdt: "" }), { ten_kh: "Tên khác" });
  assert.deepEqual(patch(columns, ["ma_kh"], { ...row, sdt: "0123" }, { sdt: "" }), { sdt: null });
});

test("required/integer/status constraints match the table API; signed warehouse keys stay numeric", () => {
  assert.equal(dataRowKey({ ma_kho: -900001 }, ["ma_kho"]), "[-900001]");
  assert.throws(() => patch([column("ten_kho", { required: true })], [], {}, { ten_kho: " " }), /không được để trống/);
  const columns = [column("trang_thai", { type: "int", required: true })];
  assert.deepEqual(patch(columns, [], { trang_thai: 1 }, { trang_thai: "0" }), { trang_thai: 0 });
  for (const value of ["1.5", "NaN", "2147483648", "3"]) assert.throws(() => patch(columns, [], {}, { trang_thai: value }));
  assert.throws(() => patch([column("ten_kh")], [], {}, { ten_kh: "a".repeat(2001) }), /quá dài/);
});

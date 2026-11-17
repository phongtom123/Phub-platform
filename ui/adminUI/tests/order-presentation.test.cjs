const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const sandbox = { exports: {}, Intl, Date, Number, String };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/features/orders/order-presentation.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const { newestOrderRows, orderListLayout } = sandbox.exports;

test("order list reads left to right: ID, date, total, status, channel, people, products", () => {
  const columns = ["ma_kh", "trang_thai", "ma_nhan_vien", "kenh_ban", "phuong_thuc_nhan", "thoi_gian_dat", "ma_donhang", "ghi_chu"].map(name => ({ name }));
  const names = layout => Array.from(layout, cell => cell.kind === "column" ? cell.column.name : cell.kind);
  assert.deepEqual(names(orderListLayout(columns, true)),
    ["ma_donhang", "thoi_gian_dat", "total", "trang_thai", "channel", "people", "products"]);
  // An API without summaries keeps the list usable, just without total and products.
  assert.deepEqual(names(orderListLayout(columns, false)), ["ma_donhang", "thoi_gian_dat", "trang_thai", "channel", "people"]);
});

test("order table renders newest order time first even when API rows are mixed", () => {
  const rows = [
    { ma_donhang: "old", thoi_gian_dat: "2026-10-25T16:24:00+07:00" },
    { ma_donhang: "middle", thoi_gian_dat: "2026-11-02T14:42:00+07:00" },
    { ma_donhang: "newest", thoi_gian_dat: "2026-11-09T20:30:00+07:00" },
    { ma_donhang: "invalid", thoi_gian_dat: "not-a-date" },
  ];
  assert.deepEqual(Array.from(newestOrderRows(rows), row => row.ma_donhang), ["newest", "middle", "old", "invalid"]);
  assert.equal(rows[0].ma_donhang, "old", "sorting must not mutate API state");
});

test("orders with the same time use descending order ID as a stable tie-breaker", () => {
  const rows = [
    { ma_donhang: "ORDER-A", thoi_gian_dat: "2026-11-11T10:00:00" },
    { ma_donhang: "ORDER-B", thoi_gian_dat: "2026-11-11T10:00:00" },
  ];
  assert.deepEqual(Array.from(newestOrderRows(rows), row => row.ma_donhang), ["ORDER-B", "ORDER-A"]);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(fetch = () => { throw new Error("No live requests allowed"); }) {
  const sandbox = { exports: {}, fetch, Date, Intl };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/features/dashboard/dashboard-data.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, sandbox);
  return sandbox.exports;
}
const { vietnamDay, orderTrend, orderStatuses, salesChannels, inventoryByWarehouse } = load();
const plain = value => JSON.parse(JSON.stringify(value));

test("Vietnam dates handle UTC midnight, naive timestamps, leap day and invalid values", () => {
  assert.equal(vietnamDay("2026-10-09T18:30:00Z"), "2026-10-10");
  assert.equal(vietnamDay("2026-10-10T00:30:00"), "2026-10-10");
  assert.equal(vietnamDay("2024-02-29T00:00:00+07:00"), "2024-02-29");
  assert.equal(vietnamDay("not-a-date"), null);
});
test("trend fills all days, excludes older/future dates and reports missing dates", () => {
  const orders = [
    { thoi_gian_dat: "2026-10-09T18:30:00Z" }, { thoi_gian_dat: "2026-10-10T01:00:00+07:00" },
    { thoi_gian_dat: "2026-10-04T00:00:00" }, { thoi_gian_dat: "2026-10-03T00:00:00" },
    { thoi_gian_dat: "2026-10-11T00:00:00" }, { thoi_gian_dat: "invalid" }, {},
  ];
  const trend = plain(orderTrend(orders, "2026-10-10", 7));
  assert.equal(trend.points.length, 7);
  assert.deepEqual(trend.points[0], { day: "2026-10-04", value: 1 });
  assert.deepEqual(trend.points[6], { day: "2026-10-10", value: 2 });
  assert.equal(trend.total, 3);
  assert.equal(trend.invalidDates, 2);
  assert.equal(orderTrend([], "2024-03-01", 7).points[5].day, "2024-02-29");
});
test("status/channel charts count cancelled and unknown rows without dropping records", () => {
  const orders = [{ trang_thai: "HOAN_THANH", kenh_ban: "ONLINE" }, { trang_thai: "HUY", kenh_ban: "TAI_QUAY" }, { trang_thai: "CUSTOM", kenh_ban: "OTHER" }, { trang_thai: "", kenh_ban: "" }];
  for (const values of [orderStatuses(orders), salesChannels(orders)]) assert.equal(values.reduce((sum, item) => sum + item.value, 0), 4);
  assert.ok(orderStatuses(orders).some(item => item.label === "Đã hủy" && item.value === 1));
  assert.equal(orderStatuses(orders).find(item => item.label === "Đã hủy").color, "#ef4444");
  assert.deepEqual(plain(orderStatuses([])), []);
});
test("inventory sums quantities per signed warehouse ID, not number of records", () => {
  const rows = [{ ma_kho: -900003, so_luong_ton: 20 }, { ma_kho: -900003, so_luong_ton: 30 }, { ma_kho: 1, so_luong_ton: 4 }, { ma_kho: 0, so_luong_ton: 0 }];
  const values = plain(inventoryByWarehouse(rows, [{ ma_kho: -900003, ten_kho: "Kho chính" }]));
  assert.equal(values[0].label, "Kho chính · -900003");
  assert.deepEqual(values.map(item => item.value), [50, 4, 0]);
  assert.throws(() => inventoryByWarehouse([{ ma_kho: 1, so_luong_ton: -1 }], []), /không hợp lệ/);
  assert.throws(() => inventoryByWarehouse([{ ma_kho: 1, so_luong_ton: "20" }], []), /không hợp lệ/);
});
test("statistics fetch every page and never silently use only 100 rows", async () => {
  const calls = [], signal = new AbortController().signal;
  const data = load(async (url, options) => {
    calls.push(url); assert.equal(options.signal, signal);
    const page = Number(new URL(url, "http://test").searchParams.get("page"));
    return { ok: true, json: async () => ({ data: Array.from({ length: page === 3 ? 1 : 100 }, (_, i) => ({ id: (page - 1) * 100 + i })), total: 201, page, page_size: 100 }) };
  });
  const rows = await data.readAllRows("orders", signal);
  assert.equal(rows.length, 201); assert.equal(rows[200].id, 200); assert.equal(calls.length, 3);
});
test("empty API data remains genuinely empty", async () => {
  const data = load(async () => ({ ok: true, json: async () => ({ data: [], total: 0, page: 1, page_size: 100 }) }));
  assert.deepEqual(plain(await data.readAllRows("orders", new AbortController().signal)), []);
});
test("API error, incomplete/changed/oversized datasets fail instead of producing fake charts", async () => {
  for (const variant of ["error", "malformed", "short", "changed", "too-large"]) {
    const data = load(async url => {
      const page = Number(new URL(url, "http://test").searchParams.get("page"));
      return { ok: variant !== "error", json: async () => variant === "error" ? { detail: "API unavailable" } : variant === "malformed" ? {} : {
        data: variant === "short" ? [] : Array.from({ length: 100 }, (_, id) => ({ id })),
        total: variant === "too-large" ? 20001 : variant === "changed" && page === 2 ? 202 : 201, page, page_size: 100,
      } };
    });
    await assert.rejects(data.readAllRows("orders", new AbortController().signal));
  }
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(fetch) {
  const sandbox = { exports: {}, URLSearchParams, require: () => ({ adminFetch: fetch }) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/features/products/product-stock-data.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, sandbox);
  return sandbox.exports.readProductStock;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const signal = () => new AbortController().signal;
const plain = value => JSON.parse(JSON.stringify(value));

test("stock sums exact SKU across all pages, preserves signed warehouse keys, and excludes partial matches", async () => {
  const rows = Array.from({length:101}, (_, index) => ({ sku: "SKU-10", ma_kho: index, so_luong_ton: 999 }));
  rows[0] = { sku: "SKU-1", ma_kho: -900003, so_luong_ton: 4 };
  rows[100] = { sku: "SKU-1", ma_kho: 0, so_luong_ton: 7 };
  const pages = [], keys = [];
  const read = load(async path => {
    const url = new URL(path, "http://localhost");
    if (url.pathname.endsWith("inventory")) {
      assert.equal(url.searchParams.get("q"), "SKU-1");
      const page = Number(url.searchParams.get("page")); pages.push(page);
      return json({ data: rows.slice((page-1)*100, page*100), total: rows.length, page, page_size:100 });
    }
    const [key] = JSON.parse(url.searchParams.get("key")); keys.push(key);
    return json({ data: [{ma_kho:key, ten_kho:`Kho ${key}`}] });
  });
  const result = plain(await read("SKU-1", signal()));
  assert.equal(result.total,11); assert.deepEqual(pages,[1,2]); assert.deepEqual(keys,[-900003,0]);
  assert.deepEqual(result.rows.map(row=>row.quantity),[4,7]);
  assert.equal(result.rows[0].warehouseName,"Kho -900003");
});

test("only a successful empty inventory result is shown as zero", async () => {
  assert.deepEqual(plain(await load(async()=>json({data:[],total:0,page:1,page_size:100}))("SKU-1", signal())), {total:0,rows:[]});
  await assert.rejects(load(async()=>json({detail:"API đang lỗi"},503))("SKU-1",signal()), /API đang lỗi/);
  await assert.rejects(load(async()=>json({data:[],total:2,page:1,page_size:100}))("SKU-1",signal()), /Chưa tải đủ/);
});

test("invalid quantities and duplicate warehouses cannot inflate the displayed total", async () => {
  for (const rows of [
    [{sku:"SKU-1",ma_kho:1,so_luong_ton:-1}],
    [{sku:"SKU-1",ma_kho:1,so_luong_ton:"20"}],
    [{sku:"SKU-1",ma_kho:1,so_luong_ton:2},{sku:"SKU-1",ma_kho:1,so_luong_ton:3}],
  ]) {
    await assert.rejects(load(async()=>json({data:rows,total:rows.length,page:1,page_size:100}))("SKU-1",signal()), /không hợp lệ/);
  }
});

test("unavailable warehouse labels preserve valid stock without fabricating a name", async () => {
  const read = load(async path => path.includes("inventory?")
    ? json({data:[{sku:"SKU-1",ma_kho:-5,so_luong_ton:20}],total:1,page:1,page_size:100})
    : json({detail:"Tên kho không tải được"},503));
  assert.deepEqual(plain(await read("SKU-1",signal())), {total:20,rows:[{warehouseId:-5,warehouseName:null,quantity:20}]});
});

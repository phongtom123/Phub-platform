const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(fetch) {
  const sandbox = { exports: {}, URLSearchParams, DOMException, require: () => ({ adminFetch: fetch }) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/features/products/product-suppliers-data.ts"),"utf8"), {
    compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText,sandbox);
  return sandbox.exports.readProductSuppliers;
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const signal=()=>new AbortController().signal;

test("supplier relationships use exact SKU and confirmed receipts; deduplicate suppliers and preserve signed IDs",async()=>{
  const lines=[-11,-12,-13,-14].map(ma_phieu_nhap=>({ma_phieu_nhap,sku:"SKU-1"}));
  lines.push({ma_phieu_nhap:-99,sku:"SKU-10"});
  const receipts={
    [-11]:{ma_phieu_nhap:-11,ma_ncc:-5,trang_thai:"DA_NHAP"},
    [-12]:{ma_phieu_nhap:-12,ma_ncc:9,trang_thai:"NHAP"},
    [-13]:{ma_phieu_nhap:-13,ma_ncc:10,trang_thai:"HUY"},
    [-14]:{ma_phieu_nhap:-14,ma_ncc:-5,trang_thai:"DA_NHAP"},
  };
  const supplierKeys=[];
  const read=load(async(path,options)=>{
    assert.equal(options.method,undefined);
    const url=new URL(path,"http://localhost");
    if(url.pathname.endsWith("receipt-lines")){
      assert.equal(url.searchParams.get("q"),"SKU-1");
      return json({data:lines,total:lines.length,page:1,page_size:100});
    }
    const [id]=JSON.parse(url.searchParams.get("key"));
    if(url.pathname.endsWith("receipts")){assert.ok(receipts[id]);return json({data:[receipts[id]]});}
    supplierKeys.push(id);
    return json({data:[{ma_ncc:-5,ten_ncc:"Nhà cung cấp A",sdt:"0123456789",email:"supplier@example.test"}]});
  });
  const result=JSON.parse(JSON.stringify(await read("SKU-1",signal())));
  assert.deepEqual(supplierKeys,[-5]);
  assert.deepEqual(result,[{id:-5,name:"Nhà cung cấp A",phone:"0123456789",email:"supplier@example.test",receipts:2}]);
});

test("empty history differs from failed or incomplete history and missing parent receipts",async()=>{
  const empty=load(async()=>json({data:[],total:0,page:1,page_size:100}));
  assert.equal((await empty("SKU-1",signal())).length,0);
  await assert.rejects(load(async()=>json({detail:"API lỗi"},503))("SKU-1",signal()),/API lỗi/);
  await assert.rejects(load(async()=>json({data:[],total:2,page:1,page_size:100}))("SKU-1",signal()),/chưa đầy đủ/);
  const missing=load(async path=>path.includes("receipt-lines?")
    ?json({data:[{ma_phieu_nhap:1,sku:"SKU-1"}],total:1,page:1,page_size:100}):json({data:[]}));
  await assert.rejects(missing("SKU-1",signal()),/Chưa tải đủ/);
});

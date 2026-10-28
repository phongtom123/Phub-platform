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
const { inlineDraftValue, inlineOptions, inlineChoiceLabel } = sandbox.exports;
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

test("product prices retain decimal precision and reject negative or out-of-range amounts and warranties", () => {
  const price = column("gia_ban_hien_tai", { type: "decimal(18,2)", required: true });
  assert.deepEqual(patch([price], [], {}, { gia_ban_hien_tai: "9999999999999999.99" }), { gia_ban_hien_tai: "9999999999999999.99" });
  assert.deepEqual(patch([price], [], {}, { gia_ban_hien_tai: "0" }), { gia_ban_hien_tai: "0" });
  for (const value of ["-1", "NaN", "1e6", "12.345", "10000000000000000", "1,000"]) {
    assert.throws(() => patch([price], [], {}, { gia_ban_hien_tai: value }), /không âm/);
  }
  assert.throws(() => patch([column("bao_hanh_thang", { type: "int" })], [], {}, { bao_hanh_thang: "-1" }), /không âm/);
});

test("enum labels remain Vietnamese while requests preserve backend string codes", () => {
  const status=column("trang_thai",{choices:["NHAP","HOAT_DONG","TAM_DUNG","KET_THUC"]});
  assert.deepEqual(patch([status],[],{trang_thai:"NHAP"},{trang_thai:"TAM_DUNG"}),{trang_thai:"TAM_DUNG"});
  assert.equal(inlineChoiceLabel("trang_thai","DA_NHAP"),"Đã nhập");
  assert.equal(inlineChoiceLabel("loai_nhan_vien","THU_KHO"),"Nhân viên kho");
  assert.equal(inlineChoiceLabel("loai_giam","PHAN_TRAM"),"Phần trăm");
  assert.equal(inlineOptions(status)[1].label,"Hoạt động");
  assert.throws(()=>patch([status],[],{}, {trang_thai:"1"}),/không hợp lệ/);
});

test("editing another field never resends normalized timestamps; datetime edits use Vietnam time", () => {
  const date=column("ngay_ket_thuc",{type:"datetime",required:true});
  const row={ngay_ket_thuc:"2026-10-25T01:30:00.123456Z",ten_chuong_trinh:"Cũ"};
  const original=inlineDraftValue(date,row.ngay_ket_thuc);
  assert.equal(original,"2026-10-25T08:30:00");
  assert.deepEqual(patch([date,column("ten_chuong_trinh")],[],row,{ngay_ket_thuc:original,ten_chuong_trinh:"Mới"}),{ten_chuong_trinh:"Mới"});
  assert.deepEqual(patch([date],[],row,{ngay_ket_thuc:"2026-10-28T08:30:00"}),{ngay_ket_thuc:"2026-10-28T01:30:00.000Z"});
});

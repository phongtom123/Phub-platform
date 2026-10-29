const { test }=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const ts=require('../../adminUI/node_modules/typescript');const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../warehouseUI/src/lib/warehouse-api.ts'),'utf8');
const sandbox={exports:{},crypto:webcrypto,Intl,BigInt};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
const {cents,displayMoney,displayDate,operationKey}=sandbox.exports;
test('receipt totals retain exact cents for large prices and quantities',()=>{
 assert.equal(cents('9999999999999999.99')*BigInt(1000000),BigInt('999999999999999999000000'));
 assert.equal(cents('0.01')*BigInt(3)+cents('0.10'),BigInt(13));
 assert.equal(displayMoney(BigInt(123456)), '1.234,56 ₫');
});
test('warehouse dates normalize legacy UTC timestamps to Vietnam time',()=>{
 assert.equal(displayDate('2026-10-29T00:00:00'),displayDate('2026-10-29T00:00:00Z'));
 assert.match(displayDate('2026-10-29T00:00:00'),/07:00/);
});
test('unknown write outcomes preserve an operation key only for identical contents',()=>{
 const first=operationKey(null,'confirm:{version:1}');assert.equal(operationKey(first,'confirm:{version:1}'),first);
 assert.notEqual(operationKey(first,'cancel:{version:1}').key,first.key);
 assert.notEqual(operationKey(first,'confirm:{version:2}').key,first.key);
});

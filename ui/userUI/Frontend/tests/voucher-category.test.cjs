const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(name,deps={}){
 const source=fs.readFileSync(path.join(__dirname,'../src/lib/shopping',name+'.ts'),'utf8');
 const scope={exports:{},require:id=>deps[id]};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,scope);
 return scope.exports;
}
const {eligibleVoucherSubtotal,estimatedVoucherDiscount,voucherScopeLabel}=load('voucher',{'./money':load('money')});
const voucher={category_id:'L_LINHKIEN',discount_type:'PHAN_TRAM',discount_value:'10.00',maximum_discount:null};
const lines=[{category_id:'L_LINHKIEN',gross_total:'400.00'},{category_id:'L_DESKTOP',gross_total:'1000.00'},{category_id:'OTHER',gross_total:'500.00'}];
test('scoped preview uses eligible lines rather than basket total',()=>{
 assert.equal(eligibleVoucherSubtotal(voucher,'1900.00',lines),40000n);
 assert.equal(estimatedVoucherDiscount(voucher,40000n),4000n);
 assert.equal(eligibleVoucherSubtotal({...voucher,category_id:'L_DESKTOP'},'1900.00',lines),100000n);
});
test('global and historical voucher previews preserve total-basket rules',()=>{
 assert.equal(eligibleVoucherSubtotal({...voucher,category_id:null},'1900.00'),190000n);
 assert.equal(eligibleVoucherSubtotal({...voucher,category_id:undefined},'1900.00'),190000n);
});
test('missing quote categories cannot silently make a scoped voucher global',()=>{
 assert.equal(eligibleVoucherSubtotal(voucher,'1900.00'),null);
 assert.equal(eligibleVoucherSubtotal(voucher,'1900.00',[{gross_total:'1900.00'}]),null);
 assert.equal(eligibleVoucherSubtotal(voucher,'1000.00',[lines[1]]),0n);
});
test('discount caps, flat amounts and rounding never leak to unrelated merchandise',()=>{
 assert.equal(estimatedVoucherDiscount({...voucher,maximum_discount:'5.00'},40000n),500n);
 assert.equal(estimatedVoucherDiscount({...voucher,discount_type:'SO_TIEN',discount_value:'500.00'},40000n),40000n);
 assert.equal(estimatedVoucherDiscount({...voucher,discount_value:'50.00'},1n),1n);
});
test('scope labels match the three allowed choices',()=>{
 assert.equal(voucherScopeLabel(null),'Tất cả sản phẩm');
 assert.equal(voucherScopeLabel('L_LINHKIEN'),'Linh kiện máy tính');
 assert.equal(voucherScopeLabel('L_DESKTOP'),'Máy tính để bàn & PC Gaming');
});

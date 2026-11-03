const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,dependencies={}){
 const scope={exports:{},Intl,require:name=>dependencies[name]};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/shopping',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,scope);return scope.exports;
}
const money=load('money.ts'),client=load('client.ts',{'./money':money});
test('VAT matches invoice rounding per discounted warehouse allocation',()=>{
 const result=money.invoiceTotals({total:'0.10',items:[{line_total:'0.05',tax_rate:'10.00'},{line_total:'0.05',tax_rate:'10.00'}]});
 assert.equal(result.tax,'0.02');assert.equal(result.total,'0.12');
 assert.equal(money.decimal(money.vatCents(money.cents('500000000.00'),'10.00')),'50000000.00');
 assert.equal(money.decimal(money.cents('9007199254740993.12')),'9007199254740993.12','large prices keep cents beyond JS floating point precision');
 assert.match(money.moneyFromCents(BigInt('9999999999999999999999')), /99\.999\.999\.999\.999\.999\.999,99/, 'oversized cart values remain displayable for a validation message');
});
test('quote permits one SKU across different warehouses, rejects duplicate allocation or forged totals',()=>{
 const line={sku:'S',warehouse_id:1,name:'Product',unit:'unit',quantity:1301,unit_price:'100.00',gross_total:'130100.00',discount:'100.00',line_total:'130000.00',tax_rate:'10.00',tax_amount:'0.00'};
 const quote={currency:'VND',tax_application:'invoice',shipping_status:'not_quoted',voucher_code:null,items:[line,{...line,warehouse_id:2}],subtotal:'260200.00',discount_total:'200.00',tax_total:'0.00',total:'260000.00'};
 assert.equal(client.validateQuote(quote),quote);
 assert.equal(money.invoiceTotals(quote).total,'286000.00');
 assert.throws(()=>client.validateQuote({...quote,items:[line,line]}));
 assert.throws(()=>client.validateQuote({...quote,total:'1.00'}));
});

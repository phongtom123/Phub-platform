const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,extra={}) {
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/catalog/'+file+'.ts'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const scope={exports:{},setTimeout,clearTimeout,AbortController,performance,URLSearchParams,...extra};vm.runInNewContext(code,scope);return scope.exports;
}
const {StockBatch,STOCK_REFRESH_MS}=load('stock-batch');
const row=(sku,quantity=10,active=true)=>({id:'P-'+sku,sku,is_active:active,available_quantity:quantity});
const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(check) {for(let i=0;i<100;i++){if(check())return;await pause();}assert.fail('Condition timed out');}

test('20 unique SKUs and duplicate cards share one request and snapshot',async()=>{
 const calls=[],store=new StockBatch(async skus=>{calls.push(skus);return skus.map(sku=>row(sku));},{delay:1});
 const stops=Array.from({length:20},(_,i)=>store.subscribe('S'+i,()=>{}));
 stops.push(store.subscribe('S0',()=>{}));
 try{await until(()=>store.get('S19'));assert.equal(calls.length,1);assert.equal(calls[0].length,20);
  assert.equal(store.get('S0').status,'available');assert.equal(store.activeCount,21);
 }finally{stops.forEach(stop=>stop());}
});
test('RAM cache is reused within TTL; expired entries and explicit reload fetch again',async()=>{
 let now=0,calls=0;const store=new StockBatch(async skus=>{calls++;return skus.map(sku=>row(sku));},{delay:1,now:()=>now});
 let stop=store.subscribe('S',()=>{});await until(()=>store.get('S'));stop();
 now=100;stop=store.subscribe('S',()=>{});await pause();assert.equal(calls,1);stop();
 now=STOCK_REFRESH_MS+1;stop=store.subscribe('S',()=>{});await until(()=>calls===2);
 store.reload('S');await until(()=>calls===3);stop();
});
test('focus/poll refreshes reuse pending requests; missing rows and errors never become zero stock',async()=>{
 let resolve;const calls=[],store=new StockBatch(skus=>{calls.push(skus);return new Promise(done=>{resolve=done;});},{delay:1});
 const stopA=store.subscribe('A',()=>{}),stopB=store.subscribe('B',()=>{});
 await until(()=>resolve);store.refreshActive();store.refreshActive();assert.equal(calls.length,1);
 resolve([row('A',0)]);await until(()=>store.get('A'));
 assert.equal(store.get('A').status,'sold_out');assert.equal(store.get('B').status,'error');
 assert.equal(store.get('B').availableQuantity,undefined);stopA();stopB();
 const failing=new StockBatch(async()=>{throw Error('Offline');},{delay:1});const stop=failing.subscribe('S',()=>{});
 await until(()=>failing.get('S'));assert.equal(failing.get('S').status,'error');stop();
});
test('paused differs from sold out and can reactivate on a shared refresh',async()=>{
 let active=false;const store=new StockBatch(async()=>[row('S',active?20:0,active)],{delay:1});
 const stop=store.subscribe('S',()=>{});await until(()=>store.get('S'));assert.equal(store.get('S').status,'inactive');
 active=true;store.refreshActive();await until(()=>store.get('S').status==='available');assert.equal(store.get('S').availableQuantity,20);stop();
});
test('manual reload supersedes an older in-flight reply',async()=>{
 const pending=[];const store=new StockBatch(()=>new Promise(resolve=>pending.push(resolve)),{delay:1});
 const stop=store.subscribe('S',()=>{});await until(()=>pending.length===1);store.reload('S');pending[0]([row('S',100)]);
 await until(()=>pending.length===2);assert.equal(store.get('S'),null);
 pending[1]([row('S',0)]);await until(()=>store.get('S'));assert.equal(store.get('S').status,'sold_out');stop();
});
test('aborting the last subscriber does not strand a new subscriber during the same request',async()=>{
 const pending=[];const store=new StockBatch((skus,signal)=>new Promise(resolve=>pending.push({resolve,signal})),{delay:1});
 let stop=store.subscribe('S',()=>{});await until(()=>pending.length===1);stop();assert.ok(pending[0].signal.aborted);
 stop=store.subscribe('S',()=>{});pending[0].resolve([row('S',100)]);await until(()=>pending.length===2);
 assert.equal(store.get('S'),null);pending[1].resolve([row('S',5)]);await until(()=>store.get('S'));assert.equal(store.get('S').availableQuantity,5);stop();
});
test('batches never exceed 100 SKUs, run sequentially, and unobserved RAM cache is bounded',async()=>{
 let running=0,maximum=0;const sizes=[],store=new StockBatch(async skus=>{maximum=Math.max(maximum,++running);sizes.push(skus.length);await pause();running--;return skus.map(sku=>row(sku));},{delay:1,cacheLimit:8});
 const stops=Array.from({length:205},(_,i)=>store.subscribe('S'+i,()=>{}));
 await until(()=>Array.from({length:205},(_,i)=>store.get('S'+i)).every(Boolean));
 assert.deepEqual(sizes,[100,100,5]);assert.equal(maximum,1);stops.forEach(stop=>stop());assert.ok(store.cacheSize<=8);assert.equal(store.activeCount,0);
});
test('unmounting before the batching window prevents an unused request',async()=>{
 let calls=0;const store=new StockBatch(async()=>{calls++;return [];},{delay:10});store.subscribe('S',()=>{})();await pause();assert.equal(calls,0);
});
test('batch client validates identity, integer quantities and unique requested rows',async()=>{
 let body={items:[row('S')]};const calls=[];
 const client=load('client',{fetch:async(url)=>{calls.push(url);return Response.json(body);}});
 const signal=new AbortController().signal;
 assert.equal((await client.getProductPurchaseStates(['S','S'],signal)).length,1);assert.equal(calls[0],'/api/catalog/purchase-states?sku=S');
 for(const bad of [{items:[row('OTHER')]},{items:[row('S'),row('S')]},{items:[row('S',-1)]},{items:[{...row('S'),is_active:'true'}]},{items:null}]){
  body=bad;await assert.rejects(()=>client.getProductPurchaseStates(['S'],signal));
 }
});

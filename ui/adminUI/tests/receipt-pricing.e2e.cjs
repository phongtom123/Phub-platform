// One focused mocked workflow; no real receipts, prices or database writes.
const assert=require('node:assert/strict');const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_TEST_BASE_URL||'http://localhost:3000';
const col=(name,type='varchar',extra={})=>({name,type,required:false,generated:false,immutable:false,default:null,choices:null,system:false,...extra});
const resources=[{name:'receipts',title:'Phiếu nhập',keys:['ma_phieu_nhap'],writable:false,columns:[col('ma_phieu_nhap','int'),col('trang_thai')]},
 {name:'warehouses',title:'Kho',keys:['ma_kho'],columns:[col('ma_kho','int'),col('ten_kho')]},
 {name:'suppliers',title:'NCC',keys:['ma_ncc'],columns:[col('ma_ncc','int'),col('ten_ncc')]},
 {name:'products',title:'Sản phẩm',keys:['ma_sp'],columns:[col('ma_sp'),col('sku'),col('ten_sp')]}];
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});try{
 const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>{dialogs.push(dialog.message());return dialog.accept();});
 let markup='20',confirmed=false,confirmCalls=0,confirmKey=null;const previews=[];
 const taxes=[{code:'VAT',name:'VAT',rate:'10',amount:'120000'},{code:'OTHER',name:'Thuế khác',rate:'2',amount:'24000'}];
 const context={sku:'S',markup_rate:'20',taxes,catalog:taxes.map(t=>({...t,active:true})),current_price:'500000.00',version:'a'.repeat(64),can_edit:true,history:[]};
 const price=()=>({unit_cost:'1000000',markup_rate:markup,profit:markup==='25'?'250000':'200000',pre_tax:markup==='25'?'1250000':'1200000',after_tax:markup==='25'?'1400000':'1344000',total_tax:markup==='25'?'150000':'144000',taxes,actual_markup:markup,margin:'16.6667'});
 const header=()=>({ma_phieu_nhap:1,ma_kho:2,ma_ncc:1,trang_thai:confirmed?'DA_NHAP':'NHAP'});
 await page.route('**/api/backend/**',async route=>{const request=route.request(),url=new URL(request.url()),endpoint=url.pathname.replace('/api/backend/','');const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(endpoint==='auth/me')return json({account_id:'A',username:'admin',role:'ADMIN',name:'Admin',employee_id:'AD',warehouse_id:null,customer_id:null});
  if(endpoint==='data/resources')return json(resources);
  if(endpoint==='data/warehouses')return json({data:[{ma_kho:2,ten_kho:'Kho test'}],total:1,filters:{}});
  if(endpoint==='data/suppliers')return json({data:[{ma_ncc:1,ten_ncc:'Nhà cung cấp'}],total:1,filters:{}});
  if(endpoint==='data/products')return json({data:[{ma_sp:'P',sku:'S',ten_sp:'Sản phẩm test',gia_ban_hien_tai:'500000'}],total:1,filters:{}});
  if(endpoint==='data/receipts')return json({data:[header()],total:1,page:1,page_size:20,filters:{}});
  if(endpoint==='data/receipt-lines')return json({data:[{ma_phieu_nhap:1,sku:'S',so_luong_nhap:1,gia_nhap:'1000000',ty_le_loi_nhuan:'25'}],total:1,filters:{ma_phieu_nhap:1}});
  if(endpoint==='pricing/preview'){const body=request.postDataJSON();previews.push(body);assert.ok(!('profit'in body)&&!('after_tax'in body));markup=body.markup_rate??'20';return json({...price(),context,current_price:'500000',price_changed:true});}
  if(endpoint==='pricing/receipts/1')return json({receipt_id:1,status:confirmed?'DA_NHAP':'NHAP',applied:confirmed,version:'b'.repeat(64),lines:[{sku:'S',quantity:1,current_price:'500000',price:price(),changed_by:'A',changed_at:'2026-10-30T01:00:00Z'}]});
  if(endpoint==='admin/operations/receipts'){
   const body=request.postDataJSON();
   if(body.action==='create'){const line=body.data.lines[0];assert.equal(line.markup_rate,'25');assert.deepEqual(line.taxes.map(t=>Object.keys(t).sort()),[['code','rate'],['code','rate']]);assert.ok(!('pre_tax'in line));return json({data:[header()],replayed:false});}
   if(body.action==='confirm'){assert.equal(body.data.pricing_version,'b'.repeat(64));confirmCalls++;if(confirmCalls===1){confirmKey=request.headers()['idempotency-key'];return json({detail:'Lỗi xác nhận thử nghiệm'},503);}assert.equal(request.headers()['idempotency-key'],confirmKey);confirmed=true;return json({data:[header()],replayed:false});}
  }
  return json({data:[],total:0,filters:{}});
 });
 await page.goto(base+'/data/receipts?workflow=new');
 assert.equal(await page.getByRole('combobox',{name:'Chọn kho',exact:true}).isDisabled(),true);
 await page.getByRole('combobox',{name:'Chọn nhà cung cấp',exact:true}).selectOption('1');
 await page.getByRole('combobox',{name:'Chọn sản phẩm dòng 1',exact:true}).selectOption('S');
 await page.getByLabel('Giá dòng 1',{exact:true}).fill('1000000');
 await page.getByText('1.344.000 ₫',{exact:true}).waitFor();
 await page.getByLabel('Tỷ lệ cộng lãi (markup, %)',{exact:true}).fill('25');
 await page.getByText('1.400.000 ₫',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Xác nhận',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.has('key'));
 await page.getByRole('button',{name:'Chỉnh sản phẩm trong phiếu',exact:true}).click();
 assert.equal(await page.getByLabel('Tỷ lệ cộng lãi (markup, %)',{exact:true}).inputValue(),'25');
 assert.equal(await page.getByLabel('Tỷ lệ OTHER (%)',{exact:true}).inputValue(),'2','reopening must retain saved taxes even when generic table metadata omits JSON');
 await page.getByRole('button',{name:'Đóng',exact:true}).click();
 await page.getByRole('button',{name:'Xác nhận nhập kho',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Lỗi xác nhận thử nghiệm'}).waitFor();
 assert.equal(await page.getByText('Đã xử lý thành công.',{exact:true}).count(),0);
 const retried=page.waitForResponse(response=>response.url().endsWith('/admin/operations/receipts')&&response.status()===200);
 await page.getByRole('button',{name:'Thử lại cùng yêu cầu',exact:true}).click();await retried;
 assert.equal(confirmCalls,2);assert.ok(previews.some(value=>value.markup_rate==='25'));assert.deepEqual(errors,[]);
 assert.ok(dialogs.some(value=>value.includes('500.000 ₫ → 1.250.000 ₫')));
 console.log('PASS: API-only previews, admin markup/tax inputs without calculated amounts, price warning, no false success, idempotent retry');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

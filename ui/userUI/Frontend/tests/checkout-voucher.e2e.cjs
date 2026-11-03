// Read-only quote fixtures: no orders, invoices, payments or database edits.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_USER_TEST_URL||'http://localhost:3001';
const profile={customer_id:'VOUCHER-TEST',name:'Voucher Test',phone:'0901234567',address_line:'Test address',province:'Test city',ward:'Test ward',payment_bypass_enabled:false};
const product={id:'P',sku:'S',name:'Voucher product',price:'2000000.00',currency:'VND',category:{id:'C',name:'Category'},subcategory:{id:'SC',name:'Sub'},brand:null,description:null,unit:'Cái',warranty_months:12,images:[],specifications:[]};
function quote(code=null){
 const discount=code?'100000.00':'0.00',total=code?'1900000.00':'2000000.00';
 return {currency:'VND',tax_application:'invoice',shipping_status:'not_quoted',voucher_code:code,subtotal:'2000000.00',discount_total:discount,tax_total:'0.00',total,
  items:[{sku:'S',warehouse_id:1,name:product.name,unit:product.unit,quantity:1,unit_price:product.price,gross_total:product.price,discount,tax_rate:'10.00',tax_amount:'0.00',line_total:total}]};
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_PATH||undefined,args:['--disable-features=LocalNetworkAccessChecks']});
 let release;
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],codes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('phub-cart-v1:VOUCHER-TEST',JSON.stringify([{product_id:'P',sku:'S',quantity:1,selected:true}])));
  let mode='invalid',hold=true;
  await page.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(path.endsWith('/checkout/quote')){
    assert.equal(request.method(),'POST');
    const code=request.postDataJSON().voucher_code;codes.push(code);
    if(!code)return route.fulfill({json:quote()});
    const outcome=mode;
    if(hold)await new Promise(resolve=>release=resolve);
    try{
     if(outcome==='invalid')return await route.fulfill({status:409,json:{error:{code:'VOUCHER_NOT_AVAILABLE',message:'Mã giảm giá không khả dụng hoặc đã hết hạn.'}}});
     return await route.fulfill({json:quote(outcome==='mismatch'?'OTHER':code)});
    }catch(error){if(!request.failure())throw error;}
    return;
   }
   assert.equal(request.method(),'GET','Voucher validation must not create business records');
   if(path.endsWith('/auth/me'))return route.fulfill({json:{account_id:'ACCOUNT',role:'KHACH_HANG',customer_id:profile.customer_id,name:profile.name,username:'test',employee_id:null,warehouse_id:null}});
   if(path.endsWith('/customer/me'))return route.fulfill({json:profile});
   if(path.endsWith('/products/P'))return route.fulfill({json:product});
   if(path.endsWith('/availability'))return route.fulfill({json:{items:[{sku:'S',available_quantity:10}],tax_rate:'10.00',currency:'VND'}});
   return route.fulfill({json:{items:[]}});
  });
  await page.goto(base+'/checkout',{waitUntil:'domcontentloaded'});
  const input=page.getByRole('textbox',{name:'Mã giảm giá',exact:true}),apply=page.getByRole('button',{name:'Áp dụng',exact:true});
  const place=page.getByRole('button',{name:'Đặt hàng',exact:true}),remove=page.getByRole('button',{name:'Bỏ mã',exact:true});
  await input.waitFor();await apply.waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Đặt hàng'&&!b.disabled));
  await input.fill(' seed100k ');await apply.click();
  await page.getByText('Đang kiểm tra mã: SEED100K…',{exact:true}).waitFor();
  assert.equal(await page.getByText(/✓ Đã áp dụng mã:/).count(),0);assert.ok(await place.isDisabled());
  release();
  await page.locator('aside').getByRole('alert').getByText(/Mã giảm giá không khả dụng hoặc đã hết hạn/).waitFor();
  await page.getByText('Chưa áp dụng mã: SEED100K',{exact:true}).waitFor();
  assert.equal(await page.getByText(/✓ Đã áp dụng mã:/).count(),0);assert.ok(await place.isDisabled());
  mode='accepted';hold=false;await apply.click();
  await page.getByText('✓ Đã áp dụng mã: SEED100K',{exact:true}).waitFor();
  assert.ok(await place.isEnabled());assert.match(await page.locator('aside').innerText(),/2\.090\.000/);
  assert.ok(codes.filter(code=>code==='SEED100K').length>=2,'same code can be retried after a rejection');
  mode='mismatch';await input.fill('SECOND');await apply.click();
  await page.locator('aside').getByRole('alert').getByText(/Chưa xác nhận được mã giảm giá/).waitFor();
  assert.equal(await page.getByText(/✓ Đã áp dụng mã:/).count(),0);assert.ok(await place.isDisabled());
  await remove.click();await page.locator('aside').getByRole('alert').waitFor({state:'detached'});
  mode='accepted';hold=true;await input.fill('LATE');await apply.click();
  await page.getByText('Đang kiểm tra mã: LATE…',{exact:true}).waitFor();
  await remove.click();release();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Đặt hàng'&&!b.disabled));
  assert.equal(await page.getByText(/✓ Đã áp dụng mã:/).count(),0,'late response cannot reapply a removed code');
  assert.deepEqual(errors,[]);
  console.log('PASS: pending/rejected codes never claim success; confirmed discounts, same-code retry, mismatched voucher rejection and cancellation of stale quotes');
 }finally{release?.();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

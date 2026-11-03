// Browser-only fixtures. No real accounts, orders or payments are created.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_USER_TEST_URL||'http://localhost:3001';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_PATH||undefined,args:['--disable-features=LocalNetworkAccessChecks']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let stock=165,mode='ok',reads=0;
  await page.addInitScript(()=>localStorage.setItem('phub-cart-guest-v1',JSON.stringify([{product_id:'P',sku:'S',quantity:100,selected:true}])));
  await page.route('**/api/**',route=>{
   assert.equal(route.request().method(),'GET');
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/me'))return route.fulfill({status:401,json:{error:{code:'AUTHENTICATION_REQUIRED',message:'Login required'}}});
   if(url.pathname.endsWith('/availability')){
    reads++;
    assert.deepEqual(url.searchParams.getAll('sku'),['S']);
    return mode==='error'?route.fulfill({status:503,json:{error:{message:'Chưa tải được tồn kho.'}}}):route.fulfill({json:{items:[{sku:'S',available_quantity:stock}],tax_rate:'10.00',currency:'VND'}});
   }
   if(url.pathname.endsWith('/products/P'))return route.fulfill({json:{id:'P',sku:'S',name:'Test Product',category:{id:'C',name:'Category'},subcategory:{id:'SC',name:'Sub'},brand:null,description:null,price:'5000000.00',currency:'VND',unit:'Cái',warranty_months:12,images:[],specifications:[]}});
   return route.fulfill({json:{items:[]}});
  });
  await page.goto(`${base}/cart`,{waitUntil:'domcontentloaded'});
  const input=page.getByRole('spinbutton',{name:'Số lượng',exact:true});
  await input.waitFor();await page.getByText('Tối đa 165 sản phẩm',{exact:true}).waitFor();
  assert.equal(await input.getAttribute('max'),'165');
  const summary=page.locator('aside');
  const total=summary.locator('p').filter({hasText:'Thành tiền sau thuế'});
  assert.match(await total.innerText(),/550\.000\.000/);
  const requests=reads;
  await input.fill('165');await input.blur();assert.equal(await input.inputValue(),'165');
  assert.match(await total.innerText(),/907\.500\.000/);
  assert.ok(await page.getByRole('button',{name:'Tăng số lượng',exact:true}).isDisabled());
  await input.fill('166');await input.blur();assert.equal(await input.inputValue(),'165');
  await input.fill('150');await input.blur();assert.equal(await input.inputValue(),'150');
  assert.match(await total.innerText(),/825\.000\.000/);
  assert.equal(reads,requests,'typing quantities reuses availability in RAM');
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-cart-stock-desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'cart fits mobile');
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-cart-stock-mobile.png'),fullPage:true});
  stock=20;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('button',{name:'Giảm còn 20',exact:true}).waitFor();
  const checkout=page.getByRole('button',{name:/Đăng nhập để thanh toán/});
  assert.ok(await checkout.isDisabled());
  await page.getByRole('button',{name:'Giảm còn 20',exact:true}).click();assert.equal(await input.inputValue(),'20');
  assert.ok(await checkout.isEnabled());
  mode='error';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('alert').getByText('Chưa tải được tồn kho.',{exact:true}).waitFor();assert.ok(await checkout.isDisabled());
  mode='ok';stock=0;await page.getByRole('button',{name:'Kiểm tra lại tồn kho',exact:true}).click();
  await page.getByText('Hết hàng',{exact:true}).waitFor();assert.ok(await input.isDisabled());assert.ok(await checkout.isDisabled());
  assert.deepEqual(errors,[]);
  console.log('PASS: aggregate stock max, >100 quantity, clamping, VAT and final total, no requests on typing, stock changes, API failure, sold-out and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

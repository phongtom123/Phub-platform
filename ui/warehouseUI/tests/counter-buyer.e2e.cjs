// Browser fixtures only: every backend request is intercepted; no hosted writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),writes=[],errors=[];
  await context.route('**/api/backend/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname.replace('/api/backend/','');
   if(request.method()==='POST') {
    assert.equal(path,'staff/counter/orders','Only fixture counter submissions are allowed');
    const body=request.postDataJSON();writes.push(body);
    return route.fulfill({status:201,json:{data:[{ma_donhang:'FIXTURE-'+writes.length,email_nguoi_mua:body.buyer_email}],replayed:false}});
   }
   assert.equal(request.method(),'GET');
   let body={data:[],total:0,page:Number(url.searchParams.get('page')||1),page_size:Number(url.searchParams.get('page_size')||20)};
   if(path==='auth/me')body={account_id:'FIXTURE',username:'staff',role:'NHAN_VIEN',name:'Staff fixture',employee_id:'NV1',warehouse_id:1,customer_id:null};
   else if(path==='data/resources')body=[{name:'orders',title:'Đơn hàng',keys:['ma_donhang'],columns:[],writable:false}];
   else if(path==='staff/counter/customers') {
    assert(url.searchParams.has('email'),'Look up customers by email');
    const email=url.searchParams.get('email');
    body={data:email==='customer@example.com'?[{ma_kh:'KH1',ten_kh:'Customer fixture',sdt:'0901234567',email,ten_tai_khoan:'customer'}]:[]};
   }
   else if(path==='staff/counter/products')body={data:[{sku:'S1',ten_sp:'Product fixture',unit_price:'100.00',warehouse_id:1,available:20}]};
   if(url.searchParams.has('filters'))body.filters=JSON.parse(url.searchParams.get('filters'));
   await route.fulfill({status:200,json:body});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const base=process.env.PHUB_STAFF_TEST_URL||'http://localhost:3002';
  await page.goto(base+'/counter',{waitUntil:'networkidle'});
  const form=page.locator('main.content form');
  const email=form.getByLabel('Email khách hàng',{exact:true});
  assert.equal(await email.getAttribute('type'),'email');
  assert.equal(await email.getAttribute('required'),'');
  await email.fill('  CUSTOMER@example.com  ');
  await form.getByRole('button',{name:'Tìm khách theo email',exact:true}).click();
  await form.getByText('Đã chọn',{exact:false}).waitFor();
  assert.equal(await form.getByLabel('Tên người mua',{exact:true}).inputValue(),'Customer fixture');
  await email.fill('missing@example.com');
  assert.equal(await form.getByLabel('Tên người mua',{exact:true}).inputValue(),'','Changing email clears the previous owner');
  await form.getByRole('button',{name:'Tìm khách theo email',exact:true}).click();
  await form.getByRole('alert').getByText('Không có tài khoản khách đang hoạt động',{exact:false}).waitFor();
  await email.fill('customer@example.com');
  await form.getByRole('button',{name:'Tìm khách theo email',exact:true}).click();
  await form.getByText('Đã chọn',{exact:false}).waitFor();
  await form.getByRole('button',{name:'Tìm hàng trong kho',exact:true}).click();
  await form.getByLabel('Thêm sản phẩm',{exact:true}).selectOption('S1:1');
  await form.getByRole('button',{name:'Tạo đơn tại quầy',exact:true}).click();
  await page.getByRole('status').getByText('Đã tạo đơn FIXTURE-1',{exact:false}).waitFor();
  assert.equal(writes[0].customer_id,'KH1');
  assert.equal(writes[0].buyer_email,'customer@example.com');
  await page.getByRole('button',{name:'Tạo đơn tiếp theo'}).click();
  await form.getByRole('radio',{name:'Khách vãng lai',exact:true}).check();
  await form.getByLabel('Tên người mua',{exact:true}).fill('Walk-in fixture');
  await form.getByLabel('Thêm sản phẩm',{exact:true}).selectOption('S1:1');
  await form.getByRole('button',{name:'Tạo đơn tại quầy',exact:true}).click();
  assert.equal(writes.length,1,'Guest email is required before creating an order');
  await email.fill('customer@example.com');
  if (process.env.PHUB_SCREENSHOT) { await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:process.env.PHUB_SCREENSHOT,fullPage:true}); }
  await form.getByRole('button',{name:'Tạo đơn tại quầy',exact:true}).click();
  await page.getByRole('status').getByText('Đã tạo đơn FIXTURE-2',{exact:false}).waitFor();
  assert.equal(writes[1].buyer_email,'customer@example.com');
  assert.equal(writes[1].customer_id,undefined,'A walk-in is never automatically attached to an account by email');
  await page.goto(base+'/data/orders?workflow=new',{waitUntil:'networkidle'});
  await page.getByRole('radio',{name:'Khách vãng lai',exact:true}).check();
  assert.equal(await page.getByLabel('Email khách hàng',{exact:true}).getAttribute('required'),'');
  assert.deepEqual(errors,[]);
  console.log('Counter buyer browser: account lookup, owner reset, missing account, required guest email and both entrypoints passed (fixtures only).');
  await context.close();
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

// Browser fixtures only: every backend request is intercepted; no hosted writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),writes=[],errors=[];
  let failLookup=false, releaseSlow;
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
    const exact=url.searchParams.get('email');
    assert(exact!==null||url.searchParams.has('q'),'Lookup uses exact email or name/phone search');
    if(failLookup)return route.fulfill({status:503,json:{detail:'Lookup temporarily unavailable (fixture)'}});
    if(exact==='slow@example.com')await new Promise(resolve=>{releaseSlow=resolve;});
    const q=(exact??url.searchParams.get('q')).trim().toLowerCase();
    body={data:(exact!==null?q==='customer@example.com':['customer','0901234567'].some(value=>value.includes(q)||q.includes(value)))
     ?[{ma_kh:'KH1',ten_kh:'Customer fixture',sdt:'0901234567',email:'customer@example.com',ten_tai_khoan:'customer'}]:[]};
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
  const search=form.getByRole('combobox',{name:'Tìm tài khoản khách hàng'});
  await search.fill('0901234567');
  await form.getByRole('option',{name:/Customer fixture/}).click();
  await form.getByText('Đã chọn',{exact:false}).waitFor();
  assert.equal(await form.getByLabel('Tên người mua',{exact:true}).inputValue(),'Customer fixture');
  assert.equal(await email.inputValue(),'customer@example.com');
  assert.equal(await form.getByLabel('Số điện thoại người mua',{exact:true}).inputValue(),'0901234567');
  await search.fill('missing@example.com');
  assert.equal(await form.getByLabel('Tên người mua',{exact:true}).inputValue(),'','Changing email clears the previous owner');
  const prompt=form.getByRole('alertdialog');
  await prompt.getByText('Không tìm thấy tài khoản khách hàng',{exact:true}).waitFor();
  assert.ok(await form.getByRole('radio',{name:'Khách có tài khoản',exact:true}).isChecked(),'Do not change mode before confirmation');
  await prompt.getByRole('button',{name:'Xác nhận chuyển',exact:true}).click();
  assert.ok(await form.getByRole('radio',{name:'Khách vãng lai',exact:true}).isChecked());
  assert.equal(await email.inputValue(),'missing@example.com','Preserve the missing email when switching to guest');
  await form.getByLabel('Tên người mua',{exact:true}).fill('Guest name before account lookup');
  await email.fill('CUSTOMER@example.com');
  await prompt.getByText('Email đã có tài khoản khách hàng',{exact:true}).waitFor();
  assert.ok(await form.getByRole('radio',{name:'Khách vãng lai',exact:true}).isChecked(),'Existing email needs confirmation before attaching an account');
  assert.ok(await email.evaluate(input=>input.validity.customError),'Resolve the prompt before submitting an order');
  await prompt.getByRole('button',{name:'Xác nhận chuyển',exact:true}).click();
  await form.getByText('Đã chọn',{exact:false}).waitFor();
  assert.ok(await form.getByRole('radio',{name:'Khách có tài khoản',exact:true}).isChecked());
  assert.equal(await form.getByLabel('Tên người mua',{exact:true}).inputValue(),'Customer fixture');
  assert.equal(await email.inputValue(),'customer@example.com');
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
  await prompt.getByText('Email đã có tài khoản khách hàng',{exact:true}).waitFor();
  await prompt.getByRole('button',{name:'Giữ nguyên',exact:true}).click();
  assert.ok(await form.getByRole('radio',{name:'Khách vãng lai',exact:true}).isChecked(),'Declining conversion keeps the guest mode and entered name');
  assert.equal(await form.getByLabel('Tên người mua',{exact:true}).inputValue(),'Walk-in fixture');
  if (process.env.PHUB_SCREENSHOT) { await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:process.env.PHUB_SCREENSHOT,fullPage:true}); }
  await form.getByRole('button',{name:'Tạo đơn tại quầy',exact:true}).click();
  await page.getByRole('status').getByText('Đã tạo đơn FIXTURE-2',{exact:false}).waitFor();
  assert.equal(writes[1].buyer_email,'customer@example.com');
  assert.equal(writes[1].customer_id,undefined,'A walk-in is never automatically attached to an account by email');
  await page.goto(base+'/data/orders?workflow=new',{waitUntil:'networkidle'});
  const workflowEmail=page.getByLabel('Email khách hàng',{exact:true});
  const workflowPrompt=page.getByRole('alertdialog');
  assert.equal(await workflowEmail.getAttribute('required'),'');
  failLookup=true;
  await workflowEmail.fill('unavailable@example.com');
  await page.getByRole('alert').getByText('Lookup temporarily unavailable (fixture)',{exact:false}).waitFor();
  assert.equal(await workflowPrompt.count(),0,'API failure must not be interpreted as a missing account');
  assert.ok(await page.getByRole('radio',{name:'Khách có tài khoản',exact:true}).isChecked());
  failLookup=false;
  await page.getByRole('button',{name:'Thử lại tra cứu',exact:true}).click();
  await workflowPrompt.getByRole('button',{name:'Xác nhận chuyển',exact:true}).click();
  assert.equal(await workflowEmail.inputValue(),'unavailable@example.com');
  assert.ok(await page.getByRole('radio',{name:'Khách vãng lai',exact:true}).isChecked());
  await workflowEmail.fill('customer@example.com');
  await workflowPrompt.getByRole('button',{name:'Xác nhận chuyển',exact:true}).click();
  assert.ok(await page.getByRole('radio',{name:'Khách có tài khoản',exact:true}).isChecked());
  assert.equal(await page.getByLabel('Tên người mua',{exact:true}).inputValue(),'Customer fixture');

  // A slow missing-email lookup must not replace the result for a newer email.
  await workflowEmail.fill('slow@example.com');
  await page.waitForRequest(request=>new URL(request.url()).searchParams.get('email')==='slow@example.com');
  await workflowEmail.fill('customer@example.com');
  await page.getByRole('option',{name:/Customer fixture/}).waitFor();
  if(releaseSlow)releaseSlow();
  await page.getByRole('option',{name:/Customer fixture/}).click();
  assert.equal(await workflowPrompt.count(),0);
  assert.equal(await workflowEmail.inputValue(),'customer@example.com');
  assert.deepEqual(errors,[]);
  console.log('Counter buyer browser: confirmed account/guest switches, preserved email, cancellation, correct ownership payload, API error/retry, stale lookup and both entrypoints passed (fixtures only).');
  await context.close();
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

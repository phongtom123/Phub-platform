// Browser fixtures only: no live account, database, order or payment mutations.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_USER_TEST_URL||'http://localhost:3001';
const session={account_id:'ACCOUNT-TEST',username:'customer.test',role:'KHACH_HANG',name:'Khách kiểm thử',customer_id:'CUSTOMER-TEST',employee_id:null,warehouse_id:null};
const initialProfile={customer_id:session.customer_id,name:session.name,phone:'0901234567',address_line:'123 Đường thử nghiệm',province:'TP Hồ Chí Minh',ward:'Phường thử nghiệm',payment_bypass_enabled:false};
const firstOrder={id:'ORDER-TEST-1',status:'XAC_NHAN',created_at:'2026-10-14T01:00:00Z',currency:'VND',total:'1000000.00'};
const secondOrder={...firstOrder,id:'ORDER-TEST-2',status:'HUY'};
const lines=[{sku:'SKU-TEST',warehouse_id:1,name:'Sản phẩm kiểm thử',unit:'Chiếc',quantity:1,unit_price:'1200000.00',discount:'200000.00',tax_amount:'0.00',line_total:'1000000.00'}];
const pagination=(page,total=11)=>({page,page_size:10,total,total_pages:Math.ceil(total/10)});

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_PATH||undefined,args:['--disable-features=LocalNetworkAccessChecks']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  let mode='ready',profile={...initialProfile},saves=0,loggedOut=false;
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   requests.push({method:request.method(),path,search:url.search});
   const ok=json=>route.fulfill({json}),fail=(status,message)=>route.fulfill({status,json:{error:{message}}});
   if(path.endsWith('/auth/me'))return mode==='guest'||loggedOut?fail(401,'Cần đăng nhập.'):ok({...session,role:mode==='admin'?'ADMIN':session.role});
   if(path.endsWith('/auth/logout')){loggedOut=true;return ok({message:'OK'});}
   if(path.endsWith('/customer/crm/surveys'))return ok({data:[{ma_khao_sat:'SURVEY-TEST',tieu_de:'Khảo sát kiểm thử',mo_ta:'Nội dung fixture',trang_thai:'DANG_MO',han_tra_loi:'2099-12-31T23:59:59Z',hoan_thanh_luc:null}],total:1});
   if(path.endsWith('/customer/crm/surveys/SURVEY-TEST'))return ok({survey:{ma_khao_sat:'SURVEY-TEST',tieu_de:'Khảo sát kiểm thử',mo_ta:'Nội dung fixture',trang_thai:'DANG_MO',han_tra_loi:'2099-12-31T23:59:59Z'},recipient:{hoan_thanh_luc:null},questions:[],answers:[]});
   if(path.endsWith('/customer/crm/reviews/eligible'))return ok({data:[{ma_donhang:firstOrder.id,ma_sp:'PRODUCT-TEST',ten_sp:'Sản phẩm kiểm thử đánh giá',sku:'SKU-TEST',thoi_gian_dat:firstOrder.created_at,ma_danh_gia:null,so_sao:null,noi_dung:null,trang_thai:null,phien_ban:null}],total:1});
   if(path.startsWith('/api/catalog/'))return ok({items:[]});
   if(path==='/api/customer/me')return mode==='guest'||loggedOut?fail(401,'Cần đăng nhập.'):ok(profile);
   if(path==='/api/customer/addresses')return ok({items:[{id:'00000000-0000-4000-8000-000000000001',...profile,is_default:true}],item:null});
   if(mode==='expired')return fail(401,'Expired');
   if(mode==='forbidden')return fail(403,'Forbidden');
   if(path==='/api/backend/customer/me'){
    if(request.method()==='PUT'){
     saves++;const body=request.postDataJSON();
     assert.deepEqual(Object.keys(body).sort(),['name','phone','address_line','province','ward','birthday'].sort());
     if(mode==='invalid-save')return fail(422,'Số điện thoại chưa hợp lệ.');
     profile={...profile,...body};return ok(profile);
    }
    if(mode==='profile-error')return fail(503,'Không tải được hồ sơ thử nghiệm.');
    return ok(mode==='malformed'?{name:'Bad response'}:profile);
   }
   if(path==='/api/backend/customer/orders'){
    assert.equal(request.method(),'GET');
    if(mode==='orders-error')return fail(503,'Không tải được đơn thử nghiệm.');
    const current=Number(url.searchParams.get('page'));
    return ok({items:mode==='empty'?[]:[current===1?firstOrder:secondOrder],pagination:pagination(current,mode==='empty'?0:11)});
   }
   if(path===`/api/customer/orders/${firstOrder.id}`)return ok({...firstOrder,recipient:initialProfile,note:null,items:lines});
   if(path.endsWith('/invoice'))return ok({order_id:firstOrder.id,currency:'VND',invoice:{issued_at:firstOrder.created_at,subtotal:'1000000.00',discount_total:'200000.00',tax_total:'100000.00',total:'1100000.00'},items:lines});
   if(path.endsWith('/payments'))return ok({order_id:firstOrder.id,currency:'VND',latest_transaction:null,message:'Chưa có giao dịch.'});
   if(path.endsWith('/transactions'))return ok({order_id:firstOrder.id,currency:'VND',items:[],pagination:pagination(1,0)});
   throw new Error(`Unexpected API: ${request.method()} ${path}`);
  });
  const nav=page.getByRole('navigation',{name:'Quản lý tài khoản'});
  const info=page.getByRole('region',{name:'Thông tin cá nhân',exact:true});
  const orders=page.getByRole('region',{name:'Đơn hàng của tôi',exact:true});
  async function open(){await page.goto(base+'/main/profile',{waitUntil:'domcontentloaded'});await info.getByText(profile.name,{exact:true}).waitFor();}
  const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'profile fits viewport');
  await open();
  await page.getByRole('heading',{name:'Tài khoản của tôi',exact:true}).waitFor();
  assert.equal(await nav.getByRole('button').count(),3);
  assert.equal(await nav.getByRole('button',{name:'Thông tin cá nhân',exact:true}).getAttribute('aria-current'),'page');
  assert.equal(await page.locator('main').getByText(/Chưa có API|Compare Products|My Wish List|Newsletter|Stored Payment|Change Password/).count(),0);
  await page.getByRole('region',{name:'Đơn hàng gần đây',exact:true}).getByRole('article',{name:`Đơn ${firstOrder.id}`}).waitFor();
  assert.ok(requests.some(r=>r.path.endsWith('/customer/orders')&&r.search.includes('page_size=5')),'profile loads a bounded recent-order preview');
  await fits();
  await page.screenshot({path:process.env.PHUB_ACCOUNT_DESKTOP_SCREENSHOT||require('node:path').join(require('node:os').tmpdir(),'phub-profile-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Chỉnh sửa thông tin',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Thông tin cá nhân và nhận hàng'});
  await dialog.getByLabel('Họ và tên').fill('Tên chưa lưu');await dialog.getByRole('button',{name:'Hủy',exact:true}).click();assert.equal(saves,0);
  await page.getByRole('button',{name:'Chỉnh sửa thông tin',exact:true}).click();
  await dialog.getByLabel('Họ và tên').fill('Khách đã cập nhật');mode='invalid-save';
  await dialog.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
  await dialog.getByRole('alert').getByText('Số điện thoại chưa hợp lệ.',{exact:true}).waitFor();
  mode='ready';await dialog.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
  await page.getByText('Đã lưu thông tin nhận hàng vào hồ sơ.',{exact:true}).waitFor();
  await open();await nav.getByRole('button',{name:'Địa chỉ giao hàng',exact:true}).click();
  const address=page.getByRole('region',{name:'Địa chỉ giao hàng',exact:true});
  await address.getByText('Địa chỉ mặc định',{exact:true}).waitFor();
  await address.getByRole('button',{name:`Sửa địa chỉ của ${profile.name}`,exact:true}).click();await page.getByRole('dialog',{name:'Chỉnh sửa địa chỉ',exact:true}).getByRole('button',{name:'Hủy',exact:true}).click();
  await nav.getByRole('button',{name:'Đơn hàng của tôi',exact:true}).click();
  const first=orders.getByRole('article',{name:`Đơn ${firstOrder.id}`});await first.waitFor();
  assert.equal(await first.getByRole('link',{name:'Xem chi tiết',exact:true}).getAttribute('href'),`/main/orders/${firstOrder.id}`);
  await orders.getByRole('button',{name:'Trang sau',exact:true}).click();
  await orders.getByRole('article',{name:`Đơn ${secondOrder.id}`}).getByText('Đã hủy',{exact:true}).waitFor();
  await orders.getByRole('button',{name:'Trang trước',exact:true}).click();await first.waitFor();
  await first.getByRole('link',{name:'Xem chi tiết',exact:true}).click();
  await page.waitForURL(`**/main/orders/${firstOrder.id}`);
  await page.getByRole('heading',{name:'Chi tiết đơn hàng',exact:true}).waitFor();
  await page.getByRole('region',{name:'Hóa đơn của đơn hàng'}).getByText(/1\.100\.000/).waitFor();
  await open();await page.setViewportSize({width:390,height:844});await fits();
  await page.screenshot({path:process.env.PHUB_ACCOUNT_SCREENSHOT||require('node:path').join(require('node:os').tmpdir(),'phub-profile-mobile.png'),fullPage:true});
  await nav.getByRole('button',{name:'Đơn hàng của tôi',exact:true}).click();await first.waitFor();await fits();
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-profile-orders-mobile.png'),fullPage:true});
  for(const testMode of ['profile-error','malformed','orders-error']){
   mode=testMode;await page.goto(base+'/main/profile',{waitUntil:'domcontentloaded'});
   if(testMode==='orders-error')await nav.getByRole('button',{name:'Đơn hàng của tôi',exact:true}).click();
   const error=page.locator('main [role="alert"]').filter({hasText:testMode==='orders-error'?'Không tải được đơn':testMode==='malformed'?'Dữ liệu API':'Không tải được hồ sơ'});
   await error.waitFor();mode='ready';await error.getByRole('button',{name:'Thử lại',exact:true}).click();
   if(testMode==='orders-error')await first.waitFor();else await info.getByText(profile.name,{exact:true}).waitFor();
  }
  mode='empty';await open();await nav.getByRole('button',{name:'Đơn hàng của tôi',exact:true}).click();
  await orders.getByText('Bạn chưa có đơn hàng nào.',{exact:true}).waitFor();
  mode='ready';await open();mode='expired';await page.getByRole('button',{name:'Chỉnh sửa thông tin',exact:true}).click();
  await dialog.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
  await page.getByRole('region',{name:'Truy cập tài khoản'}).getByRole('alert').waitFor();assert.equal(await nav.count(),0);
  for(const testMode of ['guest','admin','forbidden']){
   mode=testMode;await page.goto(base+'/main/profile',{waitUntil:'domcontentloaded'});
   await page.getByRole('region',{name:'Truy cập tài khoản'}).getByRole('alert').waitFor();assert.equal(await nav.count(),0);
  }
  mode='ready';await open();await page.setViewportSize({width:1440,height:1000});
  const engagementNav=page.getByRole('navigation',{name:'Khảo sát và đánh giá',exact:true});
  await engagementNav.getByRole('button',{name:'Khảo sát của tôi',exact:true}).click();
  await page.getByRole('heading',{name:'Khảo sát kiểm thử',exact:true}).waitFor();
  assert.equal(await nav.count(),1);assert.equal(await engagementNav.getByRole('button',{name:'Khảo sát của tôi',exact:true}).getAttribute('aria-current'),'page');
  await page.getByRole('button',{name:'Mở khảo sát',exact:true}).click();
  await page.getByRole('button',{name:'Tải lại khảo sát',exact:true}).waitFor();assert.equal(await nav.count(),1);
  await page.getByRole('button',{name:'← Khảo sát của tôi',exact:true}).click();
  await engagementNav.getByRole('button',{name:'Đánh giá sản phẩm',exact:true}).click();
  await page.getByRole('heading',{name:'Sản phẩm kiểm thử đánh giá',exact:true}).waitFor();
  await page.getByRole('button',{name:'Viết đánh giá',exact:true}).click();
  await page.getByRole('textbox',{name:'Nội dung đánh giá',exact:true}).waitFor();assert.equal(await nav.count(),1);
  await page.getByRole('button',{name:'Hủy',exact:true}).click();
  await page.goto(base+'/main/surveys');await page.waitForURL('**/main/profile?view=surveys');
  await page.getByRole('heading',{name:'Khảo sát kiểm thử',exact:true}).waitFor();assert.equal(await nav.count(),1);
  await page.goto(base+'/main/reviews');await page.waitForURL('**/main/profile?view=reviews');
  await page.getByRole('heading',{name:'Sản phẩm kiểm thử đánh giá',exact:true}).waitFor();assert.equal(await nav.count(),1);
  await page.setViewportSize({width:390,height:844});await fits();
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-account-reviews-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-account-reviews-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:`Mở tài khoản của ${session.name}`,exact:true}).click();
  await page.getByRole('navigation',{name:'Tài khoản',exact:true}).getByRole('link',{name:'Đơn hàng của tôi',exact:true}).click();
  await page.waitForURL('**/main/profile?view=orders');
  await orders.getByRole('article',{name:`Đơn ${firstOrder.id}`}).waitFor();
  assert.equal(await nav.getByRole('button',{name:'Đơn hàng của tôi',exact:true}).getAttribute('aria-current'),'page');
  await page.reload();await orders.getByRole('article',{name:`Đơn ${firstOrder.id}`}).waitFor();
  await open();await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.waitForURL('**/auth/login');
  assert.equal(loggedOut,true);assert.deepEqual(errors,[]);
  console.log('PASS: three working sections, no placeholders, profile save/cancel/errors, addresses, order pagination and dedicated detail, access guards, logout and responsive layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

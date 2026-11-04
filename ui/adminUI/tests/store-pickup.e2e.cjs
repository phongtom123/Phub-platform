// Read-only fixtures against the local admin UI; no cloud database requests.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_ADMIN_TEST_URL||'http://localhost:3000';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const order={ma_donhang:'PICKUP-TEST',ma_kh:'C',ma_nhan_vien:null,kenh_ban:'ONLINE',trang_thai:'MOI',
   phuong_thuc_nhan:'TAI_CUA_HANG',ten_nguoi_nhan:'Pickup Customer',sdt_nguoi_nhan:'0901234567',
   dia_chi_chi_tiet:null,tinh_thanh:null,xa_phuong:null,ghi_chu:null,thoi_gian_dat:'2026-11-04T08:00:00Z'};
  const meta={name:'orders',title:'Đơn hàng',keys:['ma_donhang'],writable:false,
   columns:Object.keys(order).map(name=>({name,type:'varchar',required:name==='ma_donhang'}))};
  await page.route('**/api/**',route=>{
   assert.equal(route.request().method(),'GET');
   const p=new URL(route.request().url()).pathname,ok=json=>route.fulfill({json});
   if(p.endsWith('/auth/me'))return ok({account_id:'A',name:'Test Admin',username:'admin',role:'ADMIN'});
   if(p.endsWith('/data/resources'))return ok([meta]);
   if(p.endsWith('/admin/orders/PICKUP-TEST/detail'))return ok({order_id:'PICKUP-TEST',order,
    customer:{ma_kh:'C',ten_kh:'Pickup Customer'},employee:null,lines:[],invoice:null,payments:[],voucher_uses:[],
    financial:{invoice_id:null,invoice_status:'CHUA_LAP',payment_status:'CHUA_CO_HOA_DON',total:null,collected:'0.00',refunded:'0.00',paid:'0.00',remaining:null}});
   if(p.endsWith('/data/orders'))return ok({data:[order],total:1,page:1,page_size:20});
   if(p.endsWith('/read/settings'))return ok({store_name:'PHUB',store_address:'',store_phone:'',low_stock_threshold:5});
   throw new Error(`Unexpected endpoint ${p}`);
  });
  await page.goto(base+'/data/orders?key='+encodeURIComponent(JSON.stringify(['PICKUP-TEST'])));
  const detail=page.locator('.order-detail');
  await detail.getByText('Nhận tại cửa hàng',{exact:true}).waitFor();
  await detail.getByText('Pickup Customer',{exact:true}).first().waitFor();
  assert.equal(await detail.getByText('Địa chỉ giao hàng',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: admin detail labels pickup and recipient, hides shipping-only address fields');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

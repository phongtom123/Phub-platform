// Staff page with mocked API writes; never changes a real voucher.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_STAFF_TEST_URL||'http://localhost:3002';
const col=(name,extra={})=>({name,type:'varchar',required:false,generated:false,immutable:false,system:false,default:null,choices:null,...extra});
const meta={name:'vouchers',title:'Voucher',keys:['ma_voucher'],writable:true,columns:[
 col('ma_voucher',{type:'int',generated:true}),col('ma_code',{required:true}),
 col('ma_loai_sp_ap_dung',{choices:['L_LINHKIEN','L_DESKTOP']}),
]};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),writes=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const row={ma_voucher:1,ma_code:'SCOPE',ma_loai_sp_ap_dung:null};
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),reply=json=>route.fulfill({json});
   if(url.pathname.endsWith('/auth/me'))return reply({account_id:'STAFF',username:'staff',role:'NHAN_VIEN',name:'Staff',employee_id:'NV',warehouse_id:1});
   if(url.pathname.endsWith('/data/resources'))return reply([meta]);
   if(url.pathname.endsWith('/data/vouchers')){
    if(req.method()!=='GET'){writes.push(req.postDataJSON());Object.assign(row,req.postDataJSON());}
    return reply({data:[row],total:1,page:1,page_size:20});
   }
   return reply({items:[]});
  });
  await page.goto(base+'/data/vouchers?new=1',{waitUntil:'domcontentloaded'});
  const scope=page.locator('.live-form label').filter({hasText:'Phạm vi áp dụng'}).locator('select');await scope.waitFor();
  assert.deepEqual(await scope.locator('option').allTextContents(),['Tất cả sản phẩm','Linh kiện máy tính','Máy tính để bàn & PC Gaming']);
  await page.getByLabel('Mã giảm giá *',{exact:true}).fill('SCOPE');
  await scope.selectOption('L_LINHKIEN');await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
  await page.waitForURL(/key=/);assert.equal(writes.at(-1).ma_loai_sp_ap_dung,'L_LINHKIEN');
  await page.goto(base+'/data/vouchers?key=%5B1%5D&edit=1',{waitUntil:'domcontentloaded'});
  await scope.selectOption('');await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.has('key')&&!url.searchParams.has('edit'));
  assert.equal(writes.at(-1).ma_loai_sp_ap_dung,null);
  assert.deepEqual(errors,[]);console.log('PASS: staff voucher form exposes three scopes, submits category and clears it to NULL. Mocked writes only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

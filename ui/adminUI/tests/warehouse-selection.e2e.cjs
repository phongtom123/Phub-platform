// Mocked UI checks only: no real account, document or stock changes.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://localhost:3000';
const column = (name,type='varchar') => ({name,type,required:false,generated:false,immutable:false,choices:null,system:false,default:null});
const definitions = {
  warehouses:['Kho',['ma_kho'],[column('ma_kho','int'),column('ten_kho'),column('trang_thai','int')],true],
  receipts:['Phiếu nhập',['ma_phieu_nhap'],[column('ma_phieu_nhap','int'),column('ma_kho','int'),column('trang_thai')],false],
  orders:['Đơn hàng',['ma_donhang'],[column('ma_donhang'),column('trang_thai')],false],
};
const resources=Object.entries(definitions).map(([name,[title,keys,columns,writable]])=>({name,title,keys,columns,writable}));
const warehouses=[1,2,3,4].map(ma_kho=>({ma_kho,ten_kho:`Kho kiểm thử ${ma_kho}`,trang_thai:1}));

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/backend/**',route=>{
      const request=route.request(),url=new URL(request.url()),endpoint=url.pathname.replace('/api/backend/','');
      assert.equal(request.method(),'GET','choosing a warehouse must not create data');
      const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      if(endpoint==='auth/me')return json({account_id:'A',username:'admin',role:'ADMIN',name:'Admin',employee_id:'AD'});
      if(endpoint==='data/resources')return json(resources);
      if(endpoint==='data/warehouses')return json({data:warehouses,total:4,page:1,page_size:100,filters:JSON.parse(url.searchParams.get('filters')||'{}')});
      if(endpoint==='admin/operations/read/notifications')return json([]);
      return json({data:[],total:0,page:1,page_size:20,filters:{}});
    });
    await page.goto(`${base}/data/warehouses`);
    for(const warehouse of warehouses)await page.getByRole('cell',{name:warehouse.ten_kho,exact:true}).waitFor();
    await page.getByRole('link',{name:'+ Thêm kho',exact:true}).waitFor();
    await page.goto(`${base}/data/receipts?workflow=new`);
    const receiptWarehouse=page.getByRole('combobox',{name:'Chọn kho',exact:true});
    await receiptWarehouse.locator('option[value="4"]').waitFor({state:'attached'});
    assert.ok(await receiptWarehouse.isEnabled());
    await receiptWarehouse.selectOption('1');assert.equal(await receiptWarehouse.inputValue(),'1');
    await receiptWarehouse.selectOption('3');assert.equal(await receiptWarehouse.inputValue(),'3');
    await page.goto(`${base}/data/orders?workflow=new`);
    const orderWarehouse=page.getByRole('combobox',{name:'Kho xuất dòng 1',exact:true});
    await orderWarehouse.locator('option[value="4"]').waitFor({state:'attached'});
    assert.ok(await orderWarehouse.isEnabled());await orderWarehouse.selectOption('4');assert.equal(await orderWarehouse.inputValue(),'4');
    await page.goto(`${base}/accounts/new`);
    await page.getByLabel('Loại tài khoản',{exact:false}).selectOption('NHAN_VIEN');
    const accountWarehouse=page.getByLabel('Kho phụ trách',{exact:false});
    await accountWarehouse.locator('option[value="3"]').waitFor({state:'attached'});
    await accountWarehouse.selectOption('3');assert.equal(await accountWarehouse.inputValue(),'3');
    assert.deepEqual(errors,[]);
    console.log('PASS: all four warehouses listed, warehouse management enabled, receipts/orders/account assignment accept different warehouses without writing data');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

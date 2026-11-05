/* Focused UI check with mocked APIs; never writes to a live backend. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_TEST_BASE_URL || 'http://localhost:3000';
const promotionId = -900002;
const column = (name, extra={}) => ({name,type:'varchar',required:false,generated:false,immutable:false,default:null,choices:null,system:false,...extra});
const promotion = {ma_ctkm:promotionId,ten_chuong_trinh:'Chương trình demo'};
const resources = [
  {name:'promotions',title:'Khuyến mãi',keys:['ma_ctkm'],writable:true,columns:[column('ma_ctkm',{type:'int',generated:true}),column('ten_chuong_trinh')]},
  {name:'vouchers',title:'Voucher',keys:['ma_voucher'],writable:true,columns:[column('ma_voucher',{type:'int',generated:true}),column('ma_ctkm',{type:'int',required:true}),column('ma_code',{required:true})]},
];

(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE} : {})});
  try {
    const context = await browser.newContext(), page = await context.newPage();
    const errors = []; page.on('pageerror',error=>errors.push(error.message));
    let mismatch = false;
    const requests = [];
    const vouchers = Array.from({length:11},(_,index)=>({ma_voucher:index+1,ma_ctkm:promotionId,ma_code:`DEMO${index+1}`,loai_giam:'PHAN_TRAM',gia_tri_giam:'10.00',giam_toi_da:'100000.00',gia_tri_don_toi_thieu:'500000.00',gioi_han_tong_luot:20,gioi_han_moi_khach:1,trang_thai:'HOAT_DONG'}));
    await page.route('**/api/backend/**',async route=>{
      const url = new URL(route.request().url()), endpoint = url.pathname.replace('/api/backend/','');
      const json = (body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if (endpoint==='auth/me') return json({account_id:'A',username:'admin',role:'ADMIN',name:'Admin',employee_id:'NV1',warehouse_id:null,customer_id:null});
      if (endpoint==='data/resources') return json(resources);
      if (endpoint==='data/promotions') return json({data:[promotion],total:1,page:1,page_size:50,filters:{}});
      if (endpoint==='data/vouchers') {
        requests.push(url.searchParams);
        const filters = JSON.parse(url.searchParams.get('filters')||'{}');
        assert.equal(filters.ma_ctkm,promotionId);
        const pageNumber = Number(url.searchParams.get('page')||1), size = Number(url.searchParams.get('page_size')||10), search = url.searchParams.get('q')||'';
        const filtered = vouchers.filter(row=>row.ma_code.includes(search));
        return json({data:mismatch?[{...vouchers[0],ma_ctkm:123}]:filtered.slice((pageNumber-1)*size,pageNumber*size),total:filtered.length,page:pageNumber,page_size:size,filters:mismatch?{}:filters});
      }
      return json({detail:'Unused mock endpoint'},404);
    });
    const detail = `${base}/data/promotions?key=${encodeURIComponent(JSON.stringify([promotionId]))}`;
    await page.goto(detail);
    const card = page.getByRole('region',{name:'Voucher của chương trình',exact:true});
    await card.getByRole('link',{name:'DEMO1',exact:true}).waitFor();
    assert.equal(await card.locator('tbody tr').count(),10);
    assert.equal(await card.getByRole('cell',{name:/^10%/}).count(),10);
    const all = new URL(await card.getByRole('link',{name:'Mở danh sách voucher',exact:true}).getAttribute('href'),base);
    assert.deepEqual(JSON.parse(all.searchParams.get('filters')),{ma_ctkm:promotionId});
    await card.getByRole('button',{name:'Sau',exact:true}).click();
    await card.getByRole('link',{name:'DEMO11',exact:true}).waitFor();
    assert.equal(await card.locator('tbody tr').count(),1);
    await card.getByLabel('Tìm mã voucher trong chương trình').fill('DEMO2');
    await card.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
    await card.getByRole('link',{name:'DEMO2',exact:true}).waitFor();
    assert.equal(await card.locator('tbody tr').count(),1);
    await card.getByRole('link',{name:'Thêm voucher',exact:true}).click();
    await page.getByRole('combobox',{name:'Chọn mã chương trình',exact:true}).waitFor();
    assert.equal(await page.getByRole('combobox',{name:'Chọn mã chương trình',exact:true}).inputValue(),String(promotionId));
    mismatch = true;
    await page.goto(detail);
    await page.getByRole('alert').filter({hasText:'Backend chưa lọc đúng chương trình'}).waitFor();
    assert.equal(await card.locator('tbody tr').count(),0);
    assert.ok(requests.length>=3);
    assert.deepEqual(errors,[]);
    console.log('PASS: scoped voucher card, pagination, search, prefilled create, reject unfiltered data');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

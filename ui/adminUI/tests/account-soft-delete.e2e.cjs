/** Browser fixtures only: every API request is intercepted; no live accounts are changed. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://localhost:3001';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PHUB_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [], writes = [];
    const records = ['AD1','TK1'].map((id,i) => ({ma_tk:id,ten_tai_khoan:i?'customer':'admin',email:null,
      ma_nhan_vien:i?null:'NV1',ma_kh:i?'KH1':null,trang_thai:1,role:i?'KHACH_HANG':'ADMIN',
      ho_ten:i?'Khách thử nghiệm':'Admin',ma_kho:null,owner_active:true,is_self:!i,luu_tru_luc:null,luu_tru_boi:null}));
    let failNext = true;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',d=>d.accept());
    await page.route('**/*', async route => {
      const req=route.request(), url=new URL(req.url());
      if(url.origin!==new URL(base).origin)return route.abort();
      if(!url.pathname.startsWith('/api/'))return route.continue();
      const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(url.pathname.endsWith('/auth/me'))return respond({account_id:'AD1',username:'admin',name:'Admin',role:'ADMIN'});
      if(url.pathname.endsWith('/data/resources'))return respond([]);
      if(url.pathname==='/api/backend/admin/accounts') {
        const archive=url.searchParams.get('archive')||'ACTIVE';
        const data=records.filter(r=>archive==='ALL'||(archive==='ARCHIVED')===Boolean(r.luu_tru_luc));
        return respond({data,total:data.length,page:1,page_size:20});
      }
      if(url.pathname==='/api/backend/admin/accounts/TK1/archive') {
        writes.push(req.postDataJSON());
        if(failNext){failNext=false;return respond({detail:'Không thể xóa mềm lúc này.'},409);}
        const archived=req.postDataJSON().archived;
        records[1].luu_tru_luc=archived?'2026-11-09T07:00:00Z':null;
        records[1].luu_tru_boi=archived?'AD1':null; records[1].trang_thai=0;
        return respond(records[1]);
      }
      if(url.pathname==='/api/backend/admin/accounts/TK1')return respond(records[1]);
      return respond({data:[],total:0,page:1,page_size:20});
    });
    await page.goto(base+'/accounts');
    const row=()=>page.locator('tr[data-account-id="TK1"]');
    await row().waitFor();
    assert.ok(await page.locator('tr[data-account-id="AD1"]').getByRole('button',{name:'Xóa',exact:true}).isDisabled());
    await row().getByRole('button',{name:'Xóa',exact:true}).click();
    await row().getByRole('alert').filter({hasText:'Không thể xóa mềm lúc này.'}).waitFor();
    assert.equal(await row().count(),1,'Failed writes keep the row');
    await row().getByRole('button',{name:'Xóa',exact:true}).click();
    await row().waitFor({state:'detached'});
    await page.getByRole('combobox',{name:'Trạng thái xóa',exact:true}).selectOption('ARCHIVED');
    await row().waitFor();
    assert.ok(await row().getByRole('combobox').isDisabled());
    await row().dblclick({position:{x:200,y:20}});
    assert.equal(await row().locator('input').count(),0,'Deleted rows cannot open the inline editor');
    await row().getByRole('button',{name:'Khôi phục',exact:true}).click();
    await row().waitFor({state:'detached'});
    await page.getByRole('combobox',{name:'Trạng thái xóa',exact:true}).selectOption('ALL');
    await row().waitFor();
    assert.equal(await row().getByRole('combobox').inputValue(),'0','Restore keeps account hidden');
    await row().getByRole('link',{name:'Chi tiết',exact:true}).click();
    await page.getByRole('button',{name:'Xóa tài khoản',exact:true}).click();
    await page.getByRole('button',{name:'Khôi phục tài khoản',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Chỉnh sửa',exact:true}).count(),0);
    assert.ok(await page.getByLabel('Mật khẩu mới *',{exact:true}).isDisabled());
    assert.equal(writes.length,4);
    assert.deepEqual(errors,[]);
    console.log('Account soft delete browser: filters, failed write, self protection, list/detail delete and restore passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

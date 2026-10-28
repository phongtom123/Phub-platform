/** All API traffic is mocked. Never creates or changes tickets in a real backend. */
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://127.0.0.1:3000';
const ID = 'a1111111-1111-4111-8111-111111111111';
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], patches = [], queries = [];
    let failWrite = false, empty = false;
    const item = { ma_phan_hoi: ID, ma_kh: 'KH1', ten_kh: 'Khách kiểm thử', tieu_de: 'Cần hỗ trợ kiểm tra đơn hàng',
      noi_dung: 'Tôi cần kiểm tra tình trạng đơn hàng.\nVui lòng phản hồi giúp tôi.', ma_sp: null, ma_donhang: 'DH1',
      trang_thai: 'MOI', muc_do_uu_tien: 'BINH_THUONG', nguoi_xu_ly: null, ten_nguoi_xu_ly: null,
      phan_hoi_quan_ly: null, ngay_phan_hoi: null, ngay_tao: '2026-10-23T01:00:00Z', cap_nhat_luc: '2026-10-23T01:00:00Z' };
    const admin = { ma_tk:'TK1',ten_tai_khoan:'admin.test',email:null,ma_nhan_vien:'NV1',ma_kh:null,trang_thai:1,
      role:'ADMIN',ho_ten:'Admin Test',ma_kho:null,owner_active:true,is_self:true };
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const respond = (body, status = 200) => route.fulfill({ status, contentType:'application/json',body:JSON.stringify(body) });
      if (url.pathname === '/api/backend/admin/operations/read/messages') return respond({data:[],total:0});
      if (url.pathname === '/api/backend/crm/feedback') {
        assert.equal(req.method(),'GET');
        const q = url.searchParams.get('q') || '';
        queries.push(q);
        const code = 'PH-' + ID.slice(0,8).toUpperCase();
        const fragment = q.replace(/^ph-/i,'');
        const codeMatch = /^[0-9a-f]{1,8}$/i.test(fragment) && code.slice(3).toLowerCase().startsWith(fragment.toLowerCase());
        const matches = !empty && (!q || codeMatch ||
          item.tieu_de.toLowerCase().includes(q.toLowerCase()) || item.noi_dung.toLowerCase().includes(q.toLowerCase())) &&
          (!url.searchParams.get('status') || url.searchParams.get('status') === item.trang_thai);
        return respond({ data:matches?[item]:[],total:matches?1:0,page:1,page_size:20 });
      }
      if (url.pathname === '/api/backend/crm/feedback/' + ID) {
        if (req.method() === 'GET') return respond(item);
        assert.equal(req.method(),'PATCH'); patches.push(req.postDataJSON());
        if (failWrite) return respond({ detail:'Lưu tạm lỗi; vui lòng thử lại.' },503);
        const { nhan_xu_ly, ...changes } = req.postDataJSON(); Object.assign(item,changes);
        if (nhan_xu_ly) { item.nguoi_xu_ly='NV1'; item.ten_nguoi_xu_ly='Admin Test'; }
        return respond(item);
      }
      assert.equal(req.method(),'GET','Do not allow any unexpected write to escape the mock');
      if (url.pathname.endsWith('/auth/me')) return respond({ account_id:'TK1',username:'admin.test',role:'ADMIN',name:'Admin Test' });
      if (url.pathname === '/api/backend/admin/accounts/TK1') return respond(admin);
      if (url.pathname === '/api/backend/admin/accounts') return respond({ data:[admin],total:1,page:1,page_size:20 });
      if (url.pathname === '/api/backend/data/resources') return respond([]);
      if (url.pathname.startsWith('/api/backend/data/')) return respond({ data:[],total:0,page:1,page_size:20 });
      throw Error('Unexpected API: '+url.pathname);
    });
    await page.goto(base+'/support');
    await page.locator('.support-ticket').first().waitFor();
    assert.equal(await page.getByRole('heading',{name:'Hỗ trợ khách hàng',exact:true}).count(),0);
    assert.equal(await page.getByText('Tiếp nhận phản hồi và theo dõi kết quả xử lý ticket.',{exact:true}).count(),0);
    assert.equal(await page.locator('.crumb').getByText('Hỗ trợ khách hàng',{exact:true}).count(),1);
    const search = page.getByRole('textbox',{name:'Tìm ticket',exact:true});
    assert.match(await search.getAttribute('placeholder'),/mã thẻ/);
    await search.fill('ph-a1111111');
    await Promise.all([
      page.waitForResponse(r=>r.url().includes('/api/backend/crm/feedback?') && new URL(r.url()).searchParams.get('q') === 'ph-a1111111'),
      page.getByRole('button',{name:'Tìm kiếm',exact:true}).click(),
    ]);
    await page.locator('.support-ticket').first().waitFor();
    assert.ok(queries.includes('ph-a1111111'));
    for (const term of ['A1111111','a111']) {
      await search.fill(term);
      await Promise.all([
        page.waitForResponse(r=>r.url().includes('/api/backend/crm/feedback?') && new URL(r.url()).searchParams.get('q') === term),
        page.getByRole('button',{name:'Tìm kiếm',exact:true}).click(),
      ]);
      await page.locator('.support-ticket').first().waitFor();
      assert.ok(queries.includes(term));
    }
    await search.fill('PH-DEADBEEF');
    await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
    await page.getByRole('heading',{name:'Chưa có ticket phù hợp',exact:true}).waitFor();
    await search.fill('');
    await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
    await page.locator('.support-ticket').first().waitFor();
    const marketing = page.locator('.nav-section').filter({has:page.getByRole('button',{name:'TIẾP THỊ',exact:true})});
    assert.equal(await marketing.getByRole('button',{name:'Hỗ trợ khách hàng',exact:true}).count(),1);
    assert.match(await page.locator('.support-inbox-heading').innerText(),/1 kết quả/);
    await page.locator('.support-ticket').first().click();
    await page.getByRole('heading',{name:item.tieu_de,exact:true}).waitFor();
    assert.match(page.url(),new RegExp('ticket='+ID));
    await page.evaluate(()=>window.__supportDocument='same');
    await page.getByRole('button',{name:'Nhận xử lý',exact:true}).click();
    await page.getByText('Đã nhận xử lý ticket.',{exact:true}).waitFor();
    assert.equal(item.nguoi_xu_ly,'NV1');
    await page.getByLabel('Trạng thái xử lý',{exact:true}).selectOption('DA_GIAI_QUYET');
    await page.getByLabel('Mức độ ưu tiên',{exact:true}).selectOption('CAO');
    await page.getByLabel('Phản hồi gửi khách',{exact:true}).fill('Đơn hàng đã được kiểm tra.');
    failWrite=true;
    await page.getByRole('button',{name:'Lưu xử lý',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Lưu tạm lỗi'}).waitFor();
    assert.equal(await page.getByLabel('Phản hồi gửi khách',{exact:true}).inputValue(),'Đơn hàng đã được kiểm tra.');
    failWrite=false;
    await page.getByRole('button',{name:'Lưu xử lý',exact:true}).click();
    await page.getByText('Đã lưu kết quả xử lý.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__supportDocument),'same');
    assert.equal(item.trang_thai,'DA_GIAI_QUYET');
    assert.equal(item.phan_hoi_quan_ly,'Đơn hàng đã được kiểm tra.');
    assert.equal(patches.length,3);
    await page.getByLabel('Lọc trạng thái',{exact:true}).selectOption('MOI');
    await page.getByRole('heading',{name:'Chưa có ticket phù hợp',exact:true}).waitFor();
    await page.getByLabel('Lọc trạng thái',{exact:true}).selectOption('');
    await page.locator('.support-ticket').first().waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(os.tmpdir(),'phub-support-desktop.png'),fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.main')).paddingLeft==='0px');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(os.tmpdir(),'phub-support-mobile.png'),fullPage:true,animations:'disabled'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.getByRole('button',{name:'← Danh sách ticket',exact:true}).click();
    await page.locator('.support-ticket').first().waitFor({state:'visible'});
    empty=true;
    await page.getByRole('button',{name:'Làm mới',exact:true}).click();
    await page.getByRole('heading',{name:'Chưa có ticket phù hợp',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: compact support header, ticket-code search, navigation, inbox/detail, claim, save/draft, filters, no reload and mobile. Mocked HTTP only.');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});

/* Focused, mocked banner check. No requests or writes to the live database. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_TEST_BASE_URL || 'http://localhost:3000';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const mediaId = '00000000-0000-0000-0000-000000000001';
const column = (name, extra = {}) => ({name, type:'varchar', required:false, generated:false, immutable:false, default:null, choices:null, system:false, ...extra});

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.PHUB_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE} : {})});
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const row = {ma_ctkm:1, ten_chuong_trinh:'Khuyến mãi demo', ma_media_banner:null};
    const resource = {name:'promotions', title:'Chương trình khuyến mãi', keys:['ma_ctkm'], writable:true, columns:[
      column('ma_ctkm', {type:'int', generated:true, immutable:true}), column('ten_chuong_trinh', {required:true}), column('ma_media_banner', {type:'uuid'}),
    ]};
    let uploads = 0, patches = 0, failNext = true;
    await page.route('**/banner.png', route => route.fulfill({status:200, contentType:'image/png', body:png}));
    await page.route('**/api/backend/**', async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api/backend/', '');
      const json = (body, status=200) => route.fulfill({status, contentType:'application/json', body:JSON.stringify(body)});
      if (endpoint === 'auth/me') return json({account_id:'A', username:'admin', role:'ADMIN', name:'Admin', employee_id:'NV1', warehouse_id:null, customer_id:null});
      if (endpoint === 'data/resources') return json([resource]);
      if (endpoint === 'admin/media/images') {
        assert.equal(url.searchParams.get('purpose'), 'promotion_banner'); uploads++;
        return json({media_id:mediaId, url:base+'/banner.png'}, 201);
      }
      if (endpoint === 'admin/media/images/'+mediaId) return json({media_id:mediaId, url:base+'/banner.png', width:1, height:1});
      if (endpoint === 'data/promotions') {
        if (request.method() === 'PATCH') {
          patches++;
          if (failNext) { failNext=false; return json({detail:'Lỗi lưu thử nghiệm'}, 503); }
          Object.assign(row, request.postDataJSON());
        }
        return json({data:[row], total:1, page:1, page_size:20, filters:{}});
      }
      return json({detail:'Unused mock endpoint'}, 404);
    });
    const edit = `${base}/data/promotions?key=${encodeURIComponent('[1]')}&edit=1`;
    await page.goto(edit);
    const input = page.getByLabel('Chọn banner khuyến mãi', {exact:true});
    await input.waitFor({state:'attached'});
    assert.equal(await input.getAttribute('multiple'), null);
    await input.setInputFiles({name:'banner.png', mimeType:'image/png', buffer:png});
    await page.getByAltText('Xem trước banner khuyến mãi').waitFor();
    assert.equal(uploads, 0, 'choosing an image does not upload until save');
    await page.getByRole('button', {name:'Lưu dữ liệu', exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Lỗi lưu thử nghiệm'}).waitFor();
    assert.equal(uploads, 1);
    await page.getByRole('button', {name:'Lưu dữ liệu', exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('edit'));
    assert.equal(row.ma_media_banner, mediaId); assert.equal(uploads, 1); assert.equal(patches, 2);
    await page.getByAltText('Banner Khuyến mãi demo', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Xem ảnh gốc', exact:true}).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    assert.equal(context.pages().length, 1);
    await page.getByRole('link', {name:'Chỉnh sửa', exact:true}).click();
    await page.getByRole('button', {name:'Gỡ banner', exact:true}).click();
    await page.getByRole('button', {name:'Lưu dữ liệu', exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('edit'));
    await page.getByText('Chương trình chưa có banner.', {exact:true}).waitFor();
    assert.equal(row.ma_media_banner, null); assert.equal(uploads, 1);
    assert.deepEqual(errors, []);
    console.log('PASS: single banner, deferred upload, retry reuse, same-tab preview, detach');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});

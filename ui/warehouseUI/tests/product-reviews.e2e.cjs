// All API requests are fixtures. Never submit moderation to a live database.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const products = [
      { ma_sp: 'SP1', ten_sp: 'CPU Alpha', sku: 'CPU-ALPHA', thuong_hieu: 'AMD', trang_thai: 1 },
      { ma_sp: 'SP2', ten_sp: 'GPU Beta', sku: 'GPU-BETA', thuong_hieu: 'MSI', trang_thai: 0 },
    ];
    const version = '11111111-1111-4111-8111-111111111111';
    const reviews = Array.from({ length: 22 }, (_, index) => ({
      ma_danh_gia: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      ma_kh: 'KH1', ma_sp: 'SP1', ma_donhang: '09af4453-9635-4a9a-b17e-aa6eb631eeac', so_sao: index === 0 ? 4 : 5,
      noi_dung: `Nhận xét Alpha ${index + 1}`, ten_kh: 'Khách fixture', ten_sp: 'CPU Alpha',
      trang_thai: index === 21 ? 'AN' : 'HIEN_THI', phien_ban: version,
      ngay_tao: '2026-11-07T00:00:00Z', cap_nhat_luc: '2026-11-07T00:00:00Z',
    }));
    const calls = [], writes = [], errors = [];
    let failReviews = false;
    await context.route('**/api/backend/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const path = url.pathname.replace('/api/backend/', '');
      calls.push({ path, query: url.searchParams.toString() });
      const respond = (json, status = 200) => route.fulfill({ status, json });
      if (request.method() !== 'GET') {
        assert.equal(request.method(), 'POST');
        assert.match(path, /^crm\/reviews\/[0-9a-f-]+\/moderate$/);
        const review = reviews.find(item => path.includes(item.ma_danh_gia));
        const body = request.postDataJSON();
        assert.equal(body.expected_version, review.phien_ban);
        writes.push(body);
        Object.assign(review, { trang_thai: body.status, phien_ban: '33333333-3333-4333-8333-333333333333' });
        return respond(review);
      }
      if (path === 'auth/me') return respond({ account_id: 'STAFF', username: 'staff', role: 'NHAN_VIEN', name: 'Nhân viên fixture', employee_id: 'NV1', warehouse_id: 1, customer_id: null });
      if (path === 'data/resources') return respond([]);
      const page = Number(url.searchParams.get('page') || 1);
      const paged = data => ({ data: data.slice((page - 1) * 20, page * 20), total: data.length, page, page_size: 20 });
      if (path === 'data/products') {
        const key = url.searchParams.get('key');
        const keyword = (url.searchParams.get('q') || '').toLowerCase();
        return respond(paged(products.filter(product => key ? product.ma_sp === JSON.parse(key)[0] : (product.ten_sp + ' ' + product.sku).toLowerCase().includes(keyword))));
      }
      if (path === 'crm/reviews') {
        if (failReviews) return respond({ detail: 'Không kết nối được đánh giá fixture.' }, 503);
        const product = url.searchParams.get('product_id'), status = url.searchParams.get('status');
        return respond(paged(reviews.filter(review => (!product || review.ma_sp === product) && (!status || review.trang_thai === status))));
      }
      return respond({ data: [], total: 0, page, page_size: 20 });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
    });
    page.on('dialog', dialog => dialog.accept());
    const base = process.env.PHUB_STAFF_TEST_URL || 'http://localhost:3002';
    await page.goto(base + '/reviews?view=all', { waitUntil: 'networkidle' });
    await page.getByText('22 đánh giá · Trang 1', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Tất cả đánh giá sản phẩm', exact: true }).click();
    await page.waitForResponse(response => response.url().includes('/api/backend/crm/reviews?page=1') && response.ok(), { timeout: 20000 });
    assert.equal(await page.getByRole('article').count(), 20, 'Background refresh preserves the first page of review cards');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('22 đánh giá · Trang 1', { exact: true }).waitFor();
    await page.goto(base + '/reviews', { waitUntil: 'networkidle' });
    const search = page.getByRole('search', { name: 'Tìm sản phẩm để xem đánh giá' });
    await page.getByRole('heading', { name: 'CPU Alpha', exact: true }).waitFor();
    const before = calls.filter(call => call.path === 'data/products').length;
    await search.getByLabel('Tìm sản phẩm', { exact: true }).fill('Alpha');
    assert.equal(calls.filter(call => call.path === 'data/products').length, before, 'Typing does not send a query before search submission');
    await search.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await page.waitForURL('**/reviews?q=Alpha');
    await page.getByText('1 sản phẩm ·', { exact: false }).waitFor();
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'CPU Alpha', exact: true }) }).click();
    await page.waitForURL('**product_id=SP1');
    await page.getByRole('heading', { name: 'Danh sách đánh giá', exact: true }).waitFor();
    await page.getByText('22 đánh giá · Trang 1', { exact: true }).waitFor();
    assert(calls.some(call => call.path === 'crm/reviews' && new URLSearchParams(call.query).get('product_id') === 'SP1'));
    await page.getByLabel('Lọc trạng thái đánh giá').selectOption('AN');
    await page.getByText('1 đánh giá · Trang 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Hiển thị lại', exact: true }).click();
    await page.getByText('Chưa có đánh giá phù hợp.', { exact: true }).waitFor();
    assert.equal(writes.length, 1);
    await page.getByLabel('Lọc trạng thái đánh giá').selectOption('');
    await page.getByText('22 đánh giá · Trang 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sau', exact: true }).click();
    await page.getByText('22 đánh giá · Trang 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Làm mới đánh giá', exact: true }).click();
    await page.getByText('22 đánh giá · Trang 2', { exact: true }).waitFor();
    if (process.env.PHUB_SCREENSHOT) await page.screenshot({ path: process.env.PHUB_SCREENSHOT, fullPage: true });
    failReviews = true;
    await page.getByRole('button', { name: 'Làm mới đánh giá', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Không kết nối được đánh giá fixture.' }).waitFor();
    assert.equal(await page.getByText('Nhận xét Alpha 21', { exact: true }).count(), 0, 'A failed reload does not leave old reviews visible');
    failReviews = false;
    await page.getByRole('link', { name: 'Danh sách sản phẩm', exact: true }).click();
    await page.waitForURL('**/reviews?q=Alpha');
    assert.equal(await page.getByLabel('Tìm sản phẩm', { exact: true }).inputValue(), 'Alpha');
    await page.getByLabel('Tìm sản phẩm', { exact: true }).fill('not-found');
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await page.getByRole('heading', { name: 'Không tìm thấy sản phẩm' }).waitFor();
    await page.getByLabel('Tìm sản phẩm', { exact: true }).fill('Beta');
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'GPU Beta', exact: true }) }).click();
    await page.getByText('0 đánh giá · Trang 1', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Tất cả đánh giá', exact: true }).click();
    await page.getByText('22 đánh giá · Trang 1', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/reviews', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'CPU Alpha', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'The product search must fit a mobile viewport');
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'CPU Alpha', exact: true }) }).click();
    await page.getByText('22 đánh giá · Trang 1', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Product details and review rows must fit a mobile viewport');
    if (process.env.PHUB_MOBILE_SCREENSHOT) await page.screenshot({ path: process.env.PHUB_MOBILE_SCREENSHOT, fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Product reviews browser: search, product scope, moderation/version, paging, back, empty state, reload failure and all-reviews view passed (fixtures only).');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

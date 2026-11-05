// Customer support fixtures only: no real accounts, orders or database writes.
const assert = require('node:assert/strict');
const path = require('node:path'), os = require('node:os');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3000';
const account = { account_id: 'TK-FIXTURE', username: 'fixture', role: 'KHACH_HANG', name: 'Khách kiểm thử', customer_id: 'KH-FIXTURE', employee_id: null, warehouse_id: null };
const created = { ma_phan_hoi: '11111111-1111-4111-8111-111111111111', tieu_de: 'Kiểm tra hóa đơn', noi_dung: 'Cần hỗ trợ đơn hàng này.', ma_sp: null, ma_donhang: 'DH-6', trang_thai: 'MOI', phan_hoi_quan_ly: null, ngay_phan_hoi: null, ngay_tao: '2026-11-05T03:00:00Z', cap_nhat_luc: '2026-11-05T03:00:00Z' };
const order = id => ({ id, status: 'HOAN_THANH', created_at: '2026-11-04T03:00:00Z', currency: 'VND', total: '1000000.00' });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], posts = []; let signedIn = true, failSubmit = false, listReads = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname;
      if (endpoint === '/api/backend/auth/me') return route.fulfill(signedIn ? { json: account } : { status: 401, json: { detail: 'Guest' } });
      if (endpoint === '/api/customer/me') return route.fulfill(signedIn ? { json: { customer_id: account.customer_id, name: account.name, phone: null, address_line: null, province: null, ward: null } } : { status: 401, json: { detail: 'Guest' } });
      if (endpoint === '/api/customer/orders') {
        assert.equal(req.method(), 'GET'); listReads++;
        const pageNumber = Number(url.searchParams.get('page'));
        assert.equal(url.searchParams.get('page_size'), '5');
        return route.fulfill({ json: { items: (pageNumber === 1 ? [1, 2, 3, 4, 5] : [6]).map(id => order(`DH-${id}`)), pagination: { page: pageNumber, page_size: 5, total: 6, total_pages: 2 } } });
      }
      if (endpoint.match(/^\/api\/customer\/orders\/DH-\d+\/invoice$/)) return route.fulfill({ json: { order_id: endpoint.split('/').at(-2), currency: 'VND', invoice: { issued_at: '2026-11-04T03:00:00Z', discount_total: '0.00', subtotal: '1000000.00', tax_total: '100000.00', total: '1100000.00' }, items: [] } });
      if (endpoint === '/api/backend/customer/crm/feedback' && req.method() === 'POST') {
        posts.push(req.postDataJSON());
        return route.fulfill(failSubmit ? { status: 422, json: { detail: 'Không gửi được phiếu kiểm thử.' } } : { status: 201, json: created });
      }
      if (endpoint.endsWith('/messages')) return route.fulfill({ json: { data: [], total: 0 } });
      if (endpoint.endsWith('/' + created.ma_phan_hoi)) return route.fulfill({ json: created });
      if (endpoint === '/api/backend/customer/crm/feedback') return route.fulfill({ json: { data: posts.length ? [created] : [], total: posts.length ? 1 : 0, page: 1, page_size: 10 } });
      assert.equal(req.method(), 'GET', 'No unexpected server writes');
      return route.fulfill({ json: { items: [] } });
    });
    await page.goto(base + '/contact-us', { waitUntil: 'domcontentloaded' });
    const picker = page.getByRole('region', { name: 'Hóa đơn và đơn hàng của bạn', exact: true });
    await picker.getByRole('button', { name: 'Chọn đơn DH-2', exact: true }).click();
    assert.equal(await page.locator('input[name="ma_donhang"]').inputValue(), 'DH-2');
    assert.match(await page.locator('input[name="tieu_de"]').inputValue(), /DH-2/);
    assert.equal(new URL(page.url()).pathname, '/contact-us', 'Selecting an order stays on support form');
    await picker.getByText('Đã lập hóa đơn', { exact: false }).first().waitFor();
    const pickerBox = await picker.boundingBox(), formBox = await page.locator('form').filter({ has: page.locator('input[name="tieu_de"]') }).boundingBox();
    assert.ok(pickerBox.x >= formBox.x + formBox.width, 'Order picker is beside the form on desktop');
    await page.screenshot({ path: path.join(os.tmpdir(), 'phub-support-order-picker-desktop.png') });
    assert.equal(posts.length, 0, 'Selecting never submits the ticket');
    await page.locator('input[name="tieu_de"]').fill('Kiểm tra hóa đơn');
    await page.locator('textarea[name="noi_dung"]').fill(created.noi_dung);
    await picker.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await picker.getByRole('button', { name: 'Chọn đơn DH-6', exact: true }).click();
    assert.equal(await page.locator('input[name="tieu_de"]').inputValue(), 'Kiểm tra hóa đơn');
    assert.equal(await page.locator('textarea[name="noi_dung"]').inputValue(), created.noi_dung);
    await page.getByRole('button', { name: 'Gửi liên hệ', exact: true }).click();
    await page.getByText('Đã gửi yêu cầu hỗ trợ thành công!', { exact: false }).waitFor();
    assert.deepEqual(posts[0], { tieu_de: created.tieu_de, noi_dung: created.noi_dung, ma_donhang: 'DH-6' });
    assert.equal(await page.locator('input[name="ma_donhang"]').inputValue(), '');
    await picker.getByRole('button', { name: 'Chọn đơn DH-6', exact: true }).click();
    await page.getByRole('button', { name: 'Bỏ liên kết', exact: true }).click();
    assert.equal(await page.locator('input[name="ma_donhang"]').inputValue(), '');
    assert.equal(await page.locator('input[name="tieu_de"]').inputValue(), 'Yêu cầu hỗ trợ');
    failSubmit = true;
    await page.locator('textarea[name="noi_dung"]').fill('Tư vấn chung, không cần đơn hàng.');
    await page.getByRole('button', { name: 'Gửi liên hệ', exact: true }).click();
    await page.getByText('Không gửi được phiếu kiểm thử.', { exact: true }).waitFor();
    assert.equal(posts[1].ma_donhang, undefined, 'Order relation is optional');
    assert.equal(await page.getByText('Đã gửi yêu cầu hỗ trợ thành công!', { exact: false }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow on mobile');
    await page.screenshot({ path: path.join(os.tmpdir(), 'phub-support-order-picker-mobile.png'), fullPage: true });
    const before = listReads; signedIn = false;
    await page.reload();
    await page.getByRole('heading', { name: 'Đăng nhập để gửi yêu cầu hỗ trợ', exact: true }).waitFor();
    assert.equal(await picker.count(), 0, 'Guest cannot see previous customer order data');
    assert.equal(listReads, before, 'Guest does not request private order list');
    assert.deepEqual(errors, []);
    console.log('PASS: invoice/order picker, pagination, draft preservation, linked ticket payload, optional order, backend error, mobile and guest isolation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

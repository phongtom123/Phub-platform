/** Isolated API fixtures: no live invoice/payment writes. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://localhost:3001';
const column = name => ({ name, type: 'varchar', required: false, generated: false, immutable: false, choices: null, system: false, default: null });
const order = { ma_donhang: 'SUMMARY-TEST', trang_thai: 'XAC_NHAN', kenh_ban: 'ONLINE' };
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PHUB_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PHUB_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let mode = 'normal', detailReads = 0;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith('/api/backend/')) return route.continue();
      assert.equal(route.request().method(), 'GET', 'summary must never write financial data');
      const path = url.pathname.replace('/api/backend/', '');
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === 'auth/me') return json({ account_id: 'AD1', username: 'admin', name: 'Admin', role: 'ADMIN', employee_id: 'NV1' });
      if (path === 'data/resources') return json([{ name: 'orders', title: 'Đơn hàng', keys: ['ma_donhang'], writable: false, columns: Object.keys(order).map(column) }]);
      if (['data/orders', 'data/customers', 'data/employees'].includes(path)) assert.fail('order details must reuse the aggregate order and people');
      if (path === `admin/orders/${order.ma_donhang}/detail`) {
        detailReads++;
        if (mode === 'error') return json({ detail: 'Lỗi kiểm thử tải thanh toán' }, 503);
        const paid = mode === 'paid', missing = mode === 'missing';
        return json({ order_id: order.ma_donhang, order, customer: null, employee: null, lines: [], payments: [], voucher_uses: [], history: [],
          invoice: missing ? null : { ma_hoadon: 'HD1', ma_donhang: order.ma_donhang, tong_tien_sau_thue: '1000.30' },
          financial: { invoice_id: missing ? null : 'HD1', invoice_status: missing ? 'CHUA_LAP' : 'DA_LAP',
            payment_status: missing ? 'CHUA_CO_HOA_DON' : paid ? 'DA_THU_DU' : 'THU_MOT_PHAN',
            total: missing ? null : '1000.30', collected: paid ? '1000.30' : '200.10', refunded: paid ? '0.00' : '50.05',
            paid: paid ? '1000.30' : '150.05', remaining: missing ? null : paid ? '0.00' : '850.25' } });
      }
      if (['data/invoices', 'data/payments'].includes(path)) {
        assert.fail('opening order details must use one aggregate API, not separate invoice/payment APIs');
      }
      return json({ data: [], total: 0 });
    });
    await page.goto(`${base}/data/orders?key=${encodeURIComponent(JSON.stringify([order.ma_donhang]))}`);
    const summary = page.getByRole('region', { name: 'Tổng hợp hóa đơn và thanh toán' });
    const check = async (label, value) => {
      const card = summary.locator('dl > div').filter({ has: page.locator('dt', { hasText: label }) });
      await card.locator('dd').filter({ hasText: value }).waitFor();
      assert.equal(await card.locator('dd').textContent(), value);
    };
    await check('Tổng hóa đơn', '1.000,30 ₫');
    await check('Đã thu', '200,10 ₫');
    await check('Đã hoàn', '50,05 ₫');
    await check('Còn phải thu', '850,25 ₫');
    assert.equal(detailReads, 1, 'one aggregate read on opening the order');
    mode = 'paid';
    await summary.getByRole('button').click();
    await check('Còn phải thu', '0 ₫');
    await check('Đã hoàn', '0 ₫');
    mode = 'missing';
    await summary.getByRole('button').click();
    await check('Tổng hóa đơn', 'Chưa có hóa đơn');
    await check('Còn phải thu', 'Chưa xác định');
    mode = 'error';
    await summary.getByRole('button').click();
    await page.getByRole('alert').filter({ hasText: 'Lỗi kiểm thử tải thanh toán' }).waitFor();
    assert.equal(await summary.locator('dd').count(), 0, 'failed read must not show zero balances');
    mode = 'normal';
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await check('Còn phải thu', '850,25 ₫');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await summary.evaluate(el => el.scrollWidth <= el.clientWidth), 'summary fits mobile width');
    assert.deepEqual(errors, []);
    console.log('PASS order financial summary: gross collections, refunds, pending/failed exclusion, balance, fully paid, missing invoice, errors/retry, mobile');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

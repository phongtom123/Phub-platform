// Read-only browser fixtures; no real session, stock or business writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_STAFF_TEST_URL || 'http://localhost:3002';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], reads = [];
    let failing = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      assert.equal(request.method(), 'GET', 'History must never mutate stock');
      if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: {
        account_id: 'STAFF-TEST', username: 'staff.test', role: 'NHAN_VIEN', name: 'Staff Test', employee_id: 'NV-TEST', warehouse_id: 1, customer_id: null,
      } });
      if (url.pathname.endsWith('/data/resources')) return route.fulfill({ json: [] });
      if (url.pathname.endsWith('/operations/read/history')) {
        reads.push(url.search);
        if (failing) return route.fulfill({ status: 503, json: { detail: 'Không tải được lịch sử kiểm thử.' } });
        const number = Number(url.searchParams.get('page'));
        assert.ok(!url.searchParams.has('warehouse_id'), 'Staff history must not be restricted to the assigned warehouse');
        return route.fulfill({ json: { data: [{ id: number, warehouse_id: number === 1 ? 2 : 3,
          sku: `HISTORY-SKU-${number}`, before_quantity: 20, after_quantity: number === 1 ? 18 : 25,
          reason: number === 1 ? 'orders:dispatch' : 'receipts:confirm', reference: `REFERENCE-${number}`, created_at: '2026-11-09T12:00:00Z',
        }], total: 21 } });
      }
      return route.fulfill({ json: { data: [], total: 0, page: 1, page_size: 20 } });
    });
    await page.goto(base + '/?module=orders');
    const historyButton = page.locator('aside').getByRole('button', { name: 'Lịch sử kho', exact: true });
    await historyButton.click();
    await page.waitForURL('**/history');
    const history = page.getByRole('region', { name: 'Lịch sử kho', exact: true });
    await history.getByRole('cell', { name: 'HISTORY-SKU-1', exact: true }).waitFor();
    assert.equal(await historyButton.getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('aside nav button.active').count(), 1);
    assert.ok(reads.length > 0, 'Opening the page immediately reads history without expanding a details element');
    assert.equal(await page.locator('details.operation-history').count(), 0);
    await history.getByRole('cell', { name: '-2', exact: true }).waitFor();
    await history.getByRole('button', { name: 'Sau', exact: true }).click();
    await history.getByRole('cell', { name: 'HISTORY-SKU-2', exact: true }).waitFor();
    assert.ok(await history.getByRole('button', { name: 'Sau', exact: true }).isDisabled());
    failing = true;
    await history.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await history.getByRole('alert').getByText('Không tải được lịch sử kiểm thử.', { exact: true }).waitFor();
    failing = false;
    await history.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await history.getByRole('cell', { name: 'HISTORY-SKU-2', exact: true }).waitFor();
    await page.reload();
    await history.getByRole('cell', { name: 'HISTORY-SKU-1', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.TEMP + '/phub-staff-history-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log('PASS: staff history navigation, automatic read, active menu, all-warehouse scope, signed stock movements, pagination, error/retry, direct reload and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

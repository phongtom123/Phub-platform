// Live read-only admin UI check. Credentials are supplied in the environment.
// The request guard allows only GET and login; no business writes are permitted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://localhost:3000';

(async () => {
  const username = process.env.PHUB_TEST_ADMIN_USERNAME, password = process.env.PHUB_TEST_ADMIN_PASSWORD;
  if (!username || !password) throw new Error('Set PHUB_TEST_ADMIN_USERNAME and PHUB_TEST_ADMIN_PASSWORD');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PHUB_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 500) failed.push({ status: response.status(), path: new URL(response.url()).pathname });
    });
    await page.route('**/api/**', route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      assert.ok(request.method() === 'GET' || (request.method() === 'POST' && pathname.endsWith('/auth/login')), `Unexpected business write: ${pathname}`);
      return route.continue();
    });
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('input[name=username]').fill(username);
    await page.locator('input[name=password]').fill(password);
    await page.locator('form button.submit').click();
    await page.locator('input[name=username]').waitFor({ state: 'detached', timeout: 45000 });
    console.log('PASS: admin browser login through Next.js gateway');

    async function detail(resource, key, visibleText) {
      const response = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname.endsWith(`/data/${resource}`) && url.searchParams.get('key') === JSON.stringify(key);
      }, { timeout: 45000 });
      await page.goto(`${base}/data/${resource}?key=${encodeURIComponent(JSON.stringify(key))}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal((await response).status(), 200);
      await page.waitForFunction(text => document.body.innerText.includes(text), visibleText, { timeout: 30000 });
      assert.equal(await page.locator('.live-error').count(), 0);
      console.log(JSON.stringify({ resource, key, rendered: true }));
    }
    for (const id of [900007, 900008, 900009]) await detail('receipts', [id], String(id));
    await detail('inventory', [1, 'COR-CASE-3000D-AIRFLOW-BLK'], 'COR-CASE-3000D-AIRFLOW-BLK');
    await detail('products', ['SP092'], 'COR-CASE-3000D-AIRFLOW-BLK');
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log('PASS: three receiving pages, inventory and product details; no JavaScript/API 5xx errors or business writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

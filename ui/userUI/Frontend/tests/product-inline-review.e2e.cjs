// Targeted browser fixtures. All browser writes are mocked, never sent to Supabase.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3000';
const product = process.env.PHUB_PRODUCT_TEST_ID || 'SP001';
const productUrl = `${base}/main/product/${encodeURIComponent(product)}`;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PHUB_CHROMIUM_CHANNEL || 'chrome' });
  try {
    for (const scenario of process.env.PHUB_REVIEW_SCENARIOS?.split(',') || ['guest', 'not-purchased', 'unavailable', 'buyer-desktop', 'buyer-mobile']) {
      const context = await browser.newContext({ viewport: { width: scenario.endsWith('mobile') ? 390 : 1440, height: 1000 } });
      const page = await context.newPage(), writes = [], errors = [];
      let review = null, failSave = true, eligibilityCalls = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!path.startsWith('/api/')) return route.continue();
        const respond = (json, status = 200) => route.fulfill({ json, status });
        if (path === '/api/backend/customer/crm/reviews' && request.method() === 'POST') {
          assert.ok(scenario.startsWith('buyer'));
          const body = request.postDataJSON(); writes.push(body);
          assert.equal(body.product_id, product); assert.equal(body.order_id, 'ORDER-FIXTURE');
          if (failSave) { failSave = false; return respond({ detail: 'Không lưu được đánh giá fixture.' }, 503); }
          if (review) assert.equal(body.expected_version, review.phien_ban);
          review = { ma_danh_gia: '77777777-7777-4777-8777-777777777777', ma_kh: 'KH1', ma_sp: product, ma_donhang: body.order_id, so_sao: body.stars, noi_dung: body.content, trang_thai: 'HIEN_THI', phien_ban: crypto.randomUUID(), ngay_tao: '2026-11-06T00:00:00Z', cap_nhat_luc: '2026-11-06T00:00:00Z' };
          return respond(review);
        }
        assert.equal(request.method(), 'GET', 'Never forward an unknown mutation');
        if (path.endsWith('/auth/me')) return scenario === 'guest'
          ? respond({ detail: 'Chưa đăng nhập.' }, 401)
          : respond({ account_id: 'TK1', username: 'fixture', role: 'KHACH_HANG', name: 'Khách kiểm thử', customer_id: 'KH1' });
        if (path.endsWith('/customer/me')) return scenario === 'guest' ? respond({ detail: 'Chưa đăng nhập.' }, 401)
          : respond({ customer_id: 'KH1', name: 'Khách kiểm thử', phone: null, address_line: null, province: null, ward: null });
        if (path.endsWith('/customer/crm/reviews/eligible')) {
          eligibilityCalls++; assert.equal(url.searchParams.get('product_id'), product);
          if (scenario === 'unavailable') return respond({ detail: 'Chưa kiểm tra được mua hàng fixture.' }, 503);
          const item = { ma_donhang: 'ORDER-FIXTURE', ma_sp: product, ten_sp: 'Sản phẩm fixture', sku: 'SKU1', thoi_gian_dat: '2026-11-05T00:00:00Z', ma_danh_gia: null, so_sao: null, noi_dung: null, trang_thai: null, phien_ban: null, ...(review || {}) };
          return respond({ data: scenario === 'not-purchased' ? [] : [item], total: scenario === 'not-purchased' ? 0 : 1, page: 1, page_size: 20 });
        }
        if (path.endsWith(`/products/${encodeURIComponent(product)}/reviews`)) return respond({
          data: review ? [{ author: 'Khách kiểm thử', so_sao: review.so_sao, noi_dung: review.noi_dung, ngay_tao: review.ngay_tao }] : [],
          total: review ? 1 : 0, average: review?.so_sao ?? null, stars: [1, 2, 3, 4, 5].map(stars => ({ stars, count: review?.so_sao === stars ? 1 : 0 })), page: 1, page_size: 20,
        });
        if (path.startsWith('/api/catalog/')) return respond({ items: [] });
        throw new Error('Unexpected API: ' + path);
      });
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      const region = page.getByRole('region', { name: 'Đánh giá sản phẩm', exact: true });
      await region.getByText('Hãy chia sẻ trải nghiệm của bạn', { exact: true }).waitFor();
      assert.equal(eligibilityCalls, 0, 'Only check eligibility after the user clicks');
      await region.getByRole('button', { name: 'Viết đánh giá', exact: true }).click();
      if (scenario === 'guest') {
        await region.getByText('Bạn cần đăng nhập tài khoản khách hàng để viết đánh giá.', { exact: true }).waitFor();
        assert.equal(eligibilityCalls, 0); assert.equal(await region.getByRole('form').count(), 0);
      } else if (scenario === 'not-purchased') {
        await region.getByText(/Bạn chưa có đơn hàng đã hoàn thành/).waitFor();
        assert.equal(await region.getByRole('form').count(), 0);
      } else if (scenario === 'unavailable') {
        await region.getByRole('alert').filter({ hasText: 'Chưa kiểm tra được mua hàng fixture.' }).waitFor();
        assert.equal(await region.getByText(/Bạn chưa có đơn hàng/).count(), 0, 'An API outage is not proof of no purchase');
      } else {
        await region.getByRole('form', { name: 'Viết đánh giá sản phẩm', exact: true }).waitFor();
        await region.getByRole('radio', { name: '4 sao', exact: true }).check();
        await region.getByLabel('Nội dung đánh giá', { exact: true }).fill('Nhận xét inline fixture');
        if (process.env.PHUB_REVIEW_SCREENSHOT_DIR) await region.screenshot({ path: require('node:path').join(process.env.PHUB_REVIEW_SCREENSHOT_DIR, `phub-inline-review-${scenario}.png`) });
        await region.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
        await region.getByRole('alert').filter({ hasText: 'Không lưu được đánh giá fixture.' }).waitFor();
        assert.equal(await region.getByLabel('Nội dung đánh giá').inputValue(), 'Nhận xét inline fixture');
        await region.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
        await region.locator('article').getByText('Nhận xét inline fixture', { exact: true }).waitFor();
        assert.equal(await region.getByRole('form').count(), 0);
        await region.getByRole('button', { name: 'Viết đánh giá', exact: true }).click();
        await region.getByRole('form', { name: 'Sửa đánh giá sản phẩm', exact: true }).waitFor();
        assert.equal(await region.getByLabel('Nội dung đánh giá').inputValue(), 'Nhận xét inline fixture');
        await region.getByRole('radio', { name: '2 sao', exact: true }).check();
        await region.getByLabel('Nội dung đánh giá').fill('Nhận xét đã sửa tại chỗ');
        await region.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
        await region.locator('article').getByText('Nhận xét đã sửa tại chỗ', { exact: true }).waitFor();
        assert.equal(await region.locator('article').count(), 1);
        assert.equal(writes.length, 3);
        await region.getByRole('button', { name: 'Viết đánh giá', exact: true }).click();
        await region.getByRole('form').waitFor();
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('phub-auth-session', { detail: null })));
        await region.getByRole('form').waitFor({ state: 'detached' });
      }
      assert.equal(page.url(), productUrl, 'Writing reviews must not navigate away');
      assert.equal(await region.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      assert.deepEqual(errors, []);
      console.log('PASS: ' + scenario + ' inline review, no navigation; browser writes mocked');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

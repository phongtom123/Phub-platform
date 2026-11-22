// Every API is a fixture. Writes are forbidden; no Supabase credentials are used.
// Run with the admin dev server: node ui/adminUI/tests/product-insights.e2e.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_URL || 'http://127.0.0.1:3000';
const shots = process.env.PHUB_SCREENSHOT_DIR;

const product = (sku, name, extra = {}) => ({ sku, name, category_name: 'Card màn hình', brand: 'ASUS', price: '25000000.00', quantity_sold: 3,
  revenue: '73000000.00', available_units: 4, held_units: 1, ...extra });

function report(period, start = null, end = null) {
  const row = (key, label, count, amount) => ({ key, label, count, amount, percentage: 50, amount_percentage: 50 });
  return {
    range: { start, end, period_type: period },
    product_summary: { total_products: 2, active_products: 2, paused_products: 0, hidden_products: 0, total_categories: 1, physical_units: 5, held_units: 1,
      available_units: 4, out_of_stock_products: 0, low_stock_products: 1, low_stock_threshold: 5, inventory_value: '100000000.00' },
    invoice_summary: { total_invoices: 2, valid_invoices: 2, cancelled_invoices: 0, total_amount: '80300000.00', pre_tax_amount: '73000000.00', tax_amount: '7300000.00',
      discount_amount: '0.00', avg_invoice_value: '40150000.00', collected_amount: '80300000.00', outstanding_amount: '0.00', paid_invoices: 2, partial_invoices: 0,
      unpaid_invoices: 0, items_sold: 3 },
    invoice_status: [row('PAID', 'Đã thanh toán đủ', 2, '80300000.00')], payment_methods: [row('TIEN_MAT', 'Tiền mặt', 2, '80300000.00')],
    sales_channels: [row('ONLINE', 'Trực tuyến', 2, '80300000.00')], invoice_sources: [row('TU_DONG', 'Tự động khi đặt hàng', 2, '80300000.00')],
    timeline: [
      { period: '2026-09', label: 'Tháng 09/2026', invoice_count: 3, pre_tax: '108800000.00', tax: '10880000.00', total: '119680000.00', collected: '119680000.00', items_sold: 9 },
      { period: '2026-10', label: 'Tháng 10/2026', invoice_count: 0, pre_tax: '0.00', tax: '0.00', total: '0.00', collected: '0.00', items_sold: 0 },
      { period: '2026-11', label: 'Tháng 11/2026', invoice_count: 28, pre_tax: '4141165000.00', tax: '414116500.00', total: '4555281500.00', collected: '3141468000.00', items_sold: 431 },
    ],
    categories: [{ category_id: 'GPU', category_name: 'Card màn hình', product_count: 2, available_units: 4, inventory_value: '100000000.00', quantity_sold: 3, revenue: '73000000.00', revenue_percentage: 100 }],
    top_products: [product('VGA-4070', 'VGA ASUS RTX 4070 Fixture'), product('VGA-4060', 'VGA ASUS RTX 4060 Fixture', { quantity_sold: 1 })],
    slow_products: [], low_stock_products: [product('VGA-4070', 'VGA ASUS RTX 4070 Fixture')],
    price_ranges: [
      { key: 'LT_1M', label: 'Dưới 1 triệu', count: 0, percentage: 0, categories: [] },
      { key: '5M_10M', label: '5 - 10 triệu', count: 1, percentage: 33.3, categories: [{ category_id: 'CPU', category_name: 'Bộ vi xử lý Fixture', product_count: 1, available_units: 9, inventory_value: '9000000.00', quantity_sold: 1, revenue: '8000000.00', revenue_percentage: 100 }] },
      { key: 'GTE_20M', label: 'Từ 20 triệu', count: 2, percentage: 66.7, categories: [{ category_id: 'GPU', category_name: 'Card màn hình', product_count: 2, available_units: 4, inventory_value: '100000000.00', quantity_sold: 3, revenue: '73000000.00', revenue_percentage: 100 }] },
    ],
    top_brands: [
      { brand: 'ASUS', product_count: 2, quantity_sold: 3, revenue: '73000000.00', revenue_percentage: 90.1, categories: [{ category_id: 'GPU', category_name: 'Card màn hình', product_count: 2, available_units: 4, inventory_value: '100000000.00', quantity_sold: 3, revenue: '73000000.00', revenue_percentage: 100 }] },
      { brand: 'Intel Fixture', product_count: 1, quantity_sold: 1, revenue: '8000000.00', revenue_percentage: 9.9, categories: [{ category_id: 'CPU', category_name: 'Bộ vi xử lý Fixture', product_count: 1, available_units: 9, inventory_value: '9000000.00', quantity_sold: 1, revenue: '8000000.00', revenue_percentage: 100 }] },
    ],
  };
}

function productSales(sku, period, start, end) {
  // VGA-4060 sells in 12 consecutive months so the pie must fold the smallest into "Các kỳ khác".
  const months = sku === 'VGA-4070' ? ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
    : Array.from({ length: 12 }, (_, i) => `${i < 1 ? 2025 : 2026}-${String(i < 1 ? 12 : i).padStart(2, '0')}`);
  const quantities = sku === 'VGA-4070' ? [4, 0, 7, 2, 0, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return {
    sku, name: sku === 'VGA-4070' ? 'VGA ASUS RTX 4070 Fixture' : 'VGA ASUS RTX 4060 Fixture', category_name: 'Card màn hình', brand: 'ASUS',
    price: '25000000.00', status: 1, range: { start, end, period_type: period },
    summary: { quantity_sold: quantities.reduce((a, b) => a + b, 0), revenue: String(quantities.reduce((a, b) => a + b, 0) * 24000000) + '.00', invoice_count: 9,
      avg_unit_price: '24000000.00', physical_units: 5, held_units: 1, available_units: 4 },
    timeline: months.map((m, i) => ({ period: m, label: `Tháng ${m.slice(5)}/2026`, quantity: quantities[i], revenue: `${quantities[i] * 24000000}.00`, invoice_count: quantities[i] ? 1 : 0 })),
    channels: [{ key: 'ONLINE', label: 'Trực tuyến', quantity: 15, revenue: '360000000.00' }, { key: 'TAI_QUAY', label: 'Tại quầy', quantity: 10, revenue: '240000000.00' }],
    warehouses: [{ warehouse_id: 1, name: 'Kho trung tâm', physical_units: 3, held_units: 1, available_units: 2, quantity_sold: 20 },
      { warehouse_id: 2, name: 'Kho chi nhánh', physical_units: 2, held_units: 0, available_units: 2, quantity_sold: 5 }],
  };
}

const LONG_NAME = 'PC Custom Watercooling PHUB Alpha (Ryzen 9 7950X3D / RTX 4090 / Custom Loop / 128GB DDR5 / 4TB NVMe)';
// 25 catalog products: enough for two pages of 20.
const catalog = Array.from({ length: 25 }, (_, i) => ({
  sku: `SKU-${String(i + 1).padStart(2, '0')}`,
  name: i === 0 ? 'Điện thoại Demo A' : i === 1 ? LONG_NAME : `Sản phẩm ${String(i + 1).padStart(2, '0')}`,
  category_id: i % 2 ? 'GPU' : 'PHONE', category_name: i % 2 ? 'Card màn hình' : 'Điện thoại', brand: 'DemoTech', price: '1000000.00',
  status: i === 24 ? 0 : 1, physical_units: i, held_units: i % 3 === 0 && i ? 1 : 0, quantity_sold: 25 - i,
}));
function stockList(q) {
  const page = Number(q.get('page')), size = Number(q.get('page_size')), needle = (q.get('q') || '').toLowerCase();
  const fold = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
  let rows = catalog.filter(p => (q.get('status') === 'ALL' || (q.get('status') === 'HIDDEN' ? p.status === 0 : p.status === 1))
    && (!q.get('category') || p.category_id === q.get('category')) && (!needle || fold(p.name + ' ' + p.sku).includes(fold(needle))))
    .map(p => ({ ...p, available_units: p.physical_units - p.held_units, inventory_value: `${(p.physical_units - p.held_units) * 1000000}.00`,
      value_percentage: 0, revenue: `${p.quantity_sold * 1000000}.00` }));
  if (q.get('view') === 'low') rows = rows.filter(r => r.available_units <= 5);
  const sum = key => rows.reduce((a, r) => a + r[key], 0);
  return {
    view: q.get('view'), status: q.get('status'), category: q.get('category'), q: q.get('q'), start: q.get('start'), end: q.get('end'),
    page, page_size: size, total: rows.length, low_stock_threshold: 5,
    totals: { products: rows.length, physical_units: sum('physical_units'), held_units: sum('held_units'), available_units: sum('available_units'), inventory_value: `${sum('available_units') * 1000000}.00` },
    warehouses: [{ warehouse_id: 1, name: 'Kho trung tâm', physical_units: sum('physical_units'), held_units: sum('held_units'), available_units: sum('available_units') }],
    categories: [{ category_id: 'GPU', category_name: 'Card màn hình' }, { category_id: 'PHONE', category_name: 'Điện thoại' }],
    items: rows.slice((page - 1) * size, page * size),
  };
}

async function stockScenario(context, stockRequests, productRequests) {
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-22T03:00:00Z'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/product-insights', { waitUntil: 'domcontentloaded' });
  await page.getByText('Sản phẩm bán chạy', { exact: true }).waitFor();

  // Invoice trend is a bar chart: one slot per month, the empty month has no bar, values sit on top.
  const trend = page.locator('svg[role="img"][aria-label^="Tổng giá trị hóa đơn"]');
  await trend.waitFor();
  assert.equal(await trend.locator('rect[tabindex="0"]').count(), 3);
  assert.deepEqual(await trend.locator('text[class*="chartValue"]').allTextContents(), ['119,7 tr', '4,56 tỷ']);
  await page.getByRole('button', { name: 'Số hóa đơn', exact: true }).click();
  assert.deepEqual(await page.locator('svg[role="img"][aria-label^="Số hóa đơn"] text[class*="chartValue"]').allTextContents(), ['3', '28']);
  await page.locator('svg[role="img"][aria-label^="Số hóa đơn"]').scrollIntoViewIfNeeded();
  if (shots) await page.screenshot({ path: path.join(shots, 'invoice-trend.png') });

  // Price range / brand rows narrow "Theo loại sản phẩm" to that segment and scroll it into view.
  const categoryCard = page.locator('#category-breakdown');
  const categoryNames = () => categoryCard.locator('[class*="progressInfo"] > span').allTextContents();
  assert.deepEqual(await categoryNames(), ['Card màn hình']);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: /^5 - 10 triệu/ }).click();
  await categoryCard.getByText('giá 5 - 10 triệu').waitFor();
  assert.deepEqual(await categoryNames(), ['Bộ vi xử lý Fixture']);
  await page.waitForTimeout(800); // smooth scroll
  const top = await categoryCard.evaluate(el => el.getBoundingClientRect().top);
  assert.ok(top >= 0 && top < 200, `category card should be scrolled into view (top=${top})`);
  assert.equal(await page.getByRole('button', { name: /^5 - 10 triệu/ }).getAttribute('aria-pressed'), 'true');
  if (shots) await page.screenshot({ path: path.join(shots, 'segment-price.png') });
  await page.getByRole('button', { name: /^Dưới 1 triệu/ }).click();
  await categoryCard.getByText('Không có sản phẩm nào trong nhóm này.').waitFor();
  await page.getByRole('button', { name: /^Intel Fixture/ }).click();
  await categoryCard.getByText('thương hiệu Intel Fixture').waitFor();
  assert.deepEqual(await categoryNames(), ['Bộ vi xử lý Fixture']);
  // Clicking the chosen row again (or "Bỏ lọc") restores every category.
  await page.getByRole('button', { name: /^Intel Fixture/ }).click();
  await categoryCard.getByText('Đang lọc:').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /^ASUS/ }).click();
  await categoryCard.getByRole('button', { name: 'Bỏ lọc' }).click();
  assert.deepEqual(await categoryNames(), ['Card màn hình']);

  // Excel export: lazy-loaded library, full product list (all statuses, every page), readable workbook.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất Excel' }).click();
  const file = await download;
  assert.match(file.suggestedFilename(), /^phub-san-pham-hoa-don-toan-bo-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const exportCalls = stockRequests.filter(r => r.page_size === '100');
  assert.deepEqual(exportCalls.map(r => [r.view, r.status, r.page]), [['products', 'ALL', '1']]);
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  const Excel = require(path.join(__dirname, '..', 'node_modules', 'exceljs'));
  const book = new Excel.Workbook();
  await book.xlsx.load(Buffer.concat(chunks));
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ['Tổng quan', 'Hóa đơn theo kỳ', 'Phân tích hóa đơn', 'Loại sản phẩm', 'Sản phẩm']);
  assert.equal(book.getWorksheet('Sản phẩm').rowCount, 1 + catalog.length);
  assert.equal(book.getWorksheet('Hóa đơn theo kỳ').getCell('G4').value, 4555281500);
  assert.equal(await page.getByRole('button', { name: 'Xuất Excel' }).isEnabled(), true);

  // Best-seller search covers every product (view=sales, status=ALL), not just the top 10.
  await page.getByRole('searchbox', { name: 'Tìm sản phẩm trong thống kê bán hàng' }).fill('dien thoai');
  await page.getByRole('button', { name: 'Điện thoại Demo A' }).waitFor();
  const searched = stockRequests.at(-1);
  assert.deepEqual([searched.view, searched.status, searched.q, searched.page_size], ['sales', 'ALL', 'dien thoai', '10']);
  await page.getByRole('searchbox', { name: 'Tìm sản phẩm trong thống kê bán hàng' }).fill('khong co');
  await page.getByText('Không tìm thấy sản phẩm khớp “khong co”.').waitFor();
  await page.getByRole('searchbox', { name: 'Tìm sản phẩm trong thống kê bán hàng' }).fill('');
  await page.getByRole('button', { name: 'VGA ASUS RTX 4070 Fixture' }).first().waitFor();

  // Each tile opens its list with the filter that reproduces the tile's number.
  for (const [tile, view, status, heading] of [
    ['Sản phẩm đang bán', 'products', 'ACTIVE', 'Danh sách sản phẩm'], ['Tồn khả dụng', 'stock', 'ALL', 'Tồn khả dụng theo sản phẩm'],
    ['Hết / sắp hết hàng', 'low', 'ACTIVE', 'Hết hàng & sắp hết hàng'], ['Giá trị tồn (giá bán)', 'value', 'ACTIVE', 'Giá trị tồn theo giá bán'],
  ]) {
    await page.getByRole('button', { name: new RegExp('^' + tile.replace(/[()/]/g, '\\$&')) }).click();
    const list = page.getByRole('dialog', { name: heading });
    await list.waitFor();
    await list.locator('tbody tr').first().waitFor();
    const request = stockRequests.at(-1);
    assert.deepEqual([request.view, request.status, request.page], [view, status, '1']);
    if (view === 'value') {
      // Long names truncate inside a fixed-width column; the table never scrolls sideways.
      const wrapper = list.locator('table').last().locator('xpath=..');
      const before = await wrapper.evaluate(el => [el.scrollWidth, el.clientWidth, el.scrollHeight]);
      assert.ok(before[0] <= before[1], `list table overflows horizontally (${before})`);
      const longName = list.getByRole('button', { name: LONG_NAME });
      assert.ok(await longName.evaluate(el => el.scrollWidth > el.clientWidth), 'long name should be truncated');
      await longName.hover();
      const tip = page.getByRole('tooltip');
      await tip.waitFor();
      assert.equal(await tip.textContent(), LONG_NAME);
      assert.deepEqual(await wrapper.evaluate(el => [el.scrollWidth, el.clientWidth, el.scrollHeight]), before, 'hover must not resize the table');
      if (shots) await page.screenshot({ path: path.join(shots, 'value-list-hover.png') });
      await list.getByRole('button', { name: 'Sản phẩm 03' }).hover();
      assert.equal(await page.getByRole('tooltip').count(), 0, 'short names need no tooltip');
    }
    if (view === 'stock') {
      assert.equal(await list.getByRole('heading', { name: 'Theo kho' }).count(), 1);
      if (shots) await page.screenshot({ path: path.join(shots, 'stock-list.png') });
    }
    await page.keyboard.press('Escape');
    await list.waitFor({ state: 'detached' });
  }

  // Search, filter and paging inside a list; a product opens its chart on top, Escape closes only the top drawer.
  await page.getByRole('button', { name: /^Sản phẩm đang bán/ }).click();
  const list = page.getByRole('dialog', { name: 'Danh sách sản phẩm' });
  await list.getByText('Trang 1 / 2 · 24 sản phẩm').waitFor();
  assert.equal(await list.locator('tbody tr').count(), 20);
  await list.getByRole('button', { name: 'Sau' }).click();
  await list.getByText('Trang 2 / 2 · 24 sản phẩm').waitFor();
  assert.equal(await list.locator('tbody tr').count(), 4);
  await list.getByLabel('Lọc theo loại sản phẩm').selectOption('PHONE');
  await list.getByText('Trang 1 / 1 · 12 sản phẩm').waitFor();
  // Suggestions appear while typing, follow the active filters, highlight the match and are keyboard-pickable.
  const box = list.getByRole('combobox', { name: 'Tìm sản phẩm' });
  const listRequests = () => stockRequests.filter(r => r.page_size === '20');
  const listCallsBefore = listRequests().length;
  await box.pressSequentially('san pham 1', { delay: 40 });
  const options = list.getByRole('option');
  await options.first().waitFor();
  await page.waitForTimeout(600);
  // Typing only fetches suggestions: the list itself is not reloaded until the search is finished.
  assert.equal(listRequests().length, listCallsBefore, 'list must not reload while typing');
  await list.getByText('Nhấn Enter để lọc danh sách theo “san pham 1”').waitFor();
  assert.deepEqual(await options.locator('strong').allTextContents(), ['Sản phẩm 11', 'Sản phẩm 13', 'Sản phẩm 15', 'Sản phẩm 17', 'Sản phẩm 19']);
  assert.equal(await options.first().locator('mark').first().textContent(), 'Sản phẩm 1');
  const suggested = stockRequests.filter(r => r.page_size === '8').at(-1);
  assert.deepEqual([suggested.q, suggested.category, suggested.status], ['san pham 1', 'PHONE', 'ACTIVE']);
  if (shots) await page.screenshot({ path: path.join(shots, 'search-suggestions.png') });
  await box.press('ArrowDown');
  await box.press('ArrowDown');
  assert.equal(await options.nth(1).getAttribute('aria-selected'), 'true');
  await box.press('Enter');
  assert.equal(await box.inputValue(), 'Sản phẩm 13');
  await list.getByText('Trang 1 / 1 · 1 sản phẩm').waitFor();
  assert.equal(await list.getByRole('listbox').count(), 0, 'picking closes the suggestions');
  // Escape with suggestions open closes only the suggestions, never the drawer.
  await box.fill('demo');
  await options.first().waitFor();
  await box.press('Escape');
  assert.equal(await list.getByRole('listbox').count(), 0);
  assert.equal(await list.isVisible(), true, 'Escape on suggestions must not close the drawer');
  await box.fill('khong ton tai');
  await list.getByText('Không có sản phẩm khớp “khong ton tai”.').waitFor();
  // Mouse pick.
  await box.fill('demo');
  await list.getByRole('option', { name: /Điện thoại Demo A/ }).click();
  assert.equal(await box.inputValue(), 'Điện thoại Demo A');
  // Picking a suggestion finishes the search: the list reloads once with the picked name.
  await list.getByText('Kết quả cho “Điện thoại Demo A”').waitFor();
  assert.deepEqual([listRequests().at(-1).q, listRequests().at(-1).category, listRequests().at(-1).page], ['Điện thoại Demo A', 'PHONE', '1']);
  await list.getByText('Trang 1 / 1 · 1 sản phẩm').waitFor();
  // Enter without choosing a suggestion searches for the typed text.
  await box.fill('san pham');
  await options.first().waitFor();
  await box.press('Enter');
  await list.getByText('Kết quả cho “san pham”').waitFor();
  assert.equal(listRequests().at(-1).q, 'san pham');
  await list.getByText('Trang 1 / 1 · 11 sản phẩm').waitFor();
  // Emptying the box restores the full (category-filtered) list without pressing Enter.
  await box.fill('');
  await list.getByText('Trang 1 / 1 · 12 sản phẩm').waitFor();
  assert.equal(listRequests().at(-1).q, undefined);
  assert.equal(await list.getByText(/Kết quả cho/).count(), 0);
  await box.fill('demo');
  await box.press('Enter');
  await list.getByText('Trang 1 / 1 · 1 sản phẩm').waitFor();
  await list.getByRole('button', { name: 'Điện thoại Demo A' }).click();
  const chart = page.getByRole('dialog', { name: 'VGA ASUS RTX 4060 Fixture' });
  await chart.waitFor();
  assert.equal(productRequests.at(-1).sku, 'SKU-01');
  await page.keyboard.press('Escape');
  await chart.waitFor({ state: 'detached' });
  assert.equal(await list.isVisible(), true, 'Escape on the chart must not close the list underneath');
  await page.keyboard.press('Escape');
  await list.waitFor({ state: 'detached' });

  assert.deepEqual(errors, []);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const errors = [], productRequests = [], stockRequests = [], insightsRequests = [];
    await context.route('**/api/backend/**', async route => {
      assert.equal(route.request().method(), 'GET', 'All writes are forbidden');
      const url = new URL(route.request().url()), apiPath = url.pathname.replace('/api/backend/', ''), q = url.searchParams;
      if (apiPath === 'auth/me') return route.fulfill({ json: { account_id: 'AD-FIXTURE', username: 'fixture', role: 'ADMIN', name: 'Admin Fixture', employee_id: 'NV-FIXTURE', warehouse_id: null, customer_id: null } });
      if (apiPath === 'crm/analytics/product-invoice-insights') {
        insightsRequests.push(Object.fromEntries(q));
        return route.fulfill({ json: report(q.get('period'), q.get('start'), q.get('end')) });
      }
      if (apiPath === 'crm/analytics/product-sales') {
        productRequests.push(Object.fromEntries(q));
        return route.fulfill({ json: productSales(q.get('sku'), q.get('period'), q.get('start'), q.get('end')) });
      }
      if (apiPath === 'crm/analytics/product-stock') {
        stockRequests.push(Object.fromEntries(q));
        return route.fulfill({ json: stockList(q) });
      }
      if (apiPath === 'data/resources') return route.fulfill({ json: [] });
      return route.fulfill({ json: { data: [], total: 0, page: 1, page_size: 100 } });
    });
    await stockScenario(context, stockRequests, productRequests);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-11-22T03:00:00Z'));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/product-insights', { waitUntil: 'domcontentloaded' });
    await page.getByText('Sản phẩm bán chạy', { exact: true }).waitFor();

    // Click the product name: the drawer opens with that product's chart, using the page's period and range.
    const pageFilter = page.getByRole('group', { name: 'Bộ lọc toàn trang', exact: true });
    await pageFilter.getByRole('button', { name: '90 ngày' }).click();
    await pageFilter.getByRole('button', { name: 'Theo Quý' }).click();
    await page.getByRole('button', { name: 'VGA ASUS RTX 4070 Fixture' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'VGA ASUS RTX 4070 Fixture' });
    await dialog.waitFor();
    const last = productRequests.at(-1);
    assert.equal(last.sku, 'VGA-4070');
    assert.equal(last.period, 'quarter');
    assert.match(last.start, /^\d{4}-\d{2}-\d{2}$/);
    // 6 periods, zero months rendered as empty slots; bars only for non-zero periods.
    assert.equal(await dialog.locator('svg[role="img"] rect[tabindex="0"]').count(), 6);
    assert.equal(await dialog.locator('svg[role="img"] path').count(), 4);
    // A value label sits on top of every non-zero bar.
    const values = () => dialog.locator('svg[role="img"] text[class*="chartValue"]').allTextContents();
    assert.deepEqual(await values(), ['4', '7', '2', '12']);

    // Hover a bar → tooltip with exact values.
    await dialog.locator('svg[role="img"] rect[tabindex="0"]').nth(5).hover();
    const tooltip = dialog.getByRole('status').filter({ hasText: 'Tháng 11/2026' });
    await tooltip.waitFor();
    assert.match(await tooltip.innerText(), /Số lượng:\s*12/);
    if (shots) await page.screenshot({ path: path.join(shots, 'product-drawer-quantity.png') });

    // Switch metric to revenue: same bars, revenue axis.
    await dialog.getByRole('button', { name: 'Doanh thu', exact: true }).click();
    await dialog.getByRole('heading', { name: /Doanh thu chưa thuế theo quý/ }).waitFor();
    assert.match(await dialog.locator('svg[role="img"]').innerHTML(), /tr</);
    assert.deepEqual(await values(), ['96 tr', '168 tr', '48 tr', '288 tr']);
    if (shots) await page.screenshot({ path: path.join(shots, 'product-drawer-revenue.png') });

    // Pie option: one slice per selling period (zero months have no slice), legend labels every slice.
    await dialog.getByRole('button', { name: 'Tròn', exact: true }).click();
    await dialog.getByRole('heading', { name: /Tỷ trọng doanh thu chưa thuế \(đ\) theo quý/ }).waitFor();
    const legend = dialog.locator('[class*="pieLegendRow"]');
    assert.equal(await legend.count(), 4);
    assert.match(await legend.first().innerText(), /Tháng 06\/2026[\s\S]*96\.000\.000[\s\S]*16%/);
    assert.equal(await dialog.locator('svg[role="img"] rect[tabindex="0"]').count(), 0, 'bar chart is replaced, not stacked');
    await dialog.getByRole('button', { name: 'Số lượng', exact: true }).click();
    assert.match(await dialog.locator('[class*="pieCenterVal"], text').filter({ hasText: /^25$/ }).first().textContent(), /25/);
    if (shots) await page.screenshot({ path: path.join(shots, 'product-drawer-pie.png') });

    // Escape closes; clicking a row in another table opens that product instead.
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await page.locator('tr', { hasText: 'VGA ASUS RTX 4060 Fixture' }).locator('td').nth(1).click();
    await page.getByRole('dialog', { name: 'VGA ASUS RTX 4060 Fixture' }).waitFor();
    assert.equal(productRequests.at(-1).sku, 'VGA-4060');
    // The chosen chart kind is kept for the next product; 12 selling months fold into 6 + "Các kỳ khác (6)".
    const second = page.getByRole('dialog', { name: 'VGA ASUS RTX 4060 Fixture' });
    await second.getByRole('heading', { name: /Tỷ trọng số lượng bán/ }).waitFor();
    const rows = second.locator('[class*="pieLegendRow"]');
    assert.equal(await rows.count(), 7);
    assert.match(await rows.last().innerText(), /Các kỳ khác \(6\)[\s\S]*21[\s\S]*26\.9%/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400); // let the drawer's open animation finish before the screenshot
    await second.getByRole('button', { name: 'Cột', exact: true }).click();
    // 12 narrow bars: labels that would not fit are skipped, never overlapping.
    const mobileLabels = await second.locator('svg[role="img"] text[class*="chartValue"]').evaluateAll(nodes => nodes.map(n => { const box = n.getBBox(); return { x: box.x, width: box.width }; }));
    for (let i = 1; i < mobileLabels.length; i++) assert.ok(mobileLabels[i].x >= mobileLabels[i - 1].x + mobileLabels[i - 1].width, 'value labels overlap');
    await second.locator('svg[role="img"]').scrollIntoViewIfNeeded();
    if (shots) await page.screenshot({ path: path.join(shots, 'product-drawer-mobile.png') });
    const overflow = await page.evaluate(() => document.querySelector('[role="dialog"]').scrollWidth - document.querySelector('[role="dialog"]').clientWidth);
    assert.ok(overflow <= 1, `Drawer scrolls horizontally on mobile (${overflow}px)`);

    // The product's dates are independently selectable; edits wait for Apply.
    const filteredResponse = (path, expected) => page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname.endsWith(path) && Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value);
    });
    await second.getByLabel('Chọn thời gian').selectOption('month');
    await second.getByLabel('Tháng', { exact: true }).fill('2024-02');
    const monthRead = filteredResponse('product-sales', { start: '2024-02-01', end: '2024-02-29' });
    await second.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await monthRead;
    await second.getByText(/Hóa đơn lập từ 2024-02-01 đến 2024-02-29/).waitFor();

    await second.getByLabel('Chọn thời gian').selectOption('custom');
    await second.getByLabel('Từ ngày', { exact: true }).fill('2026-11-20');
    assert.equal(await second.getByLabel('Đến ngày', { exact: true }).evaluate(input => input === document.activeElement), true);
    await second.getByLabel('Đến ngày', { exact: true }).fill('2026-11-19');
    const beforeInvalid = productRequests.length;
    await second.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await second.getByRole('alert').filter({ hasText: 'Ngày bắt đầu' }).waitFor();
    assert.equal(productRequests.length, beforeInvalid, 'reversed dates must not request new figures');
    await second.getByLabel('Đến ngày', { exact: true }).fill('2026-11-22');
    const customRead = filteredResponse('product-sales', { start: '2026-11-20', end: '2026-11-22' });
    await second.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await customRead;
    await second.getByText(/Hóa đơn lập từ 2026-11-20 đến 2026-11-22/).waitFor();
    const dailyRead = filteredResponse('product-sales', { period: 'day', start: '2026-11-20', end: '2026-11-22' });
    await second.getByRole('button', { name: 'Theo Ngày', exact: true }).click();
    await dailyRead;
    await second.getByRole('heading', { name: 'Số lượng bán theo ngày', exact: true }).waitFor();

    await second.getByLabel('Chọn thời gian').selectOption('day');
    assert.equal(await second.getByLabel('Ngày', { exact: true }).getAttribute('max'), '2026-11-22');
    await second.getByLabel('Ngày', { exact: true }).fill('2026-11-23');
    const beforeFuture = productRequests.length;
    await second.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    assert.equal(await second.getByLabel('Ngày', { exact: true }).evaluate(input => input.validity.rangeOverflow), true);
    assert.equal(productRequests.length, beforeFuture, 'future days must not load a report');
    await second.getByLabel('Ngày', { exact: true }).fill('2026-11-22');
    const singleRead = filteredResponse('product-sales', { period: 'day', start: '2026-11-22', end: '2026-11-22' });
    await second.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await singleRead;
    await second.getByText(/Hóa đơn lập từ 2026-11-22 đến 2026-11-22/).waitFor();
    // Clear only the draft inputs: no request and no implicit all-time report.
    const readsBeforeClear = productRequests.length;
    await second.getByRole('button', { name: 'Xóa ngày', exact: true }).click();
    assert.equal(await second.getByLabel('Chọn thời gian').inputValue(), 'day');
    assert.equal(await second.getByLabel('Ngày', { exact: true }).inputValue(), '');
    assert.equal(productRequests.length, readsBeforeClear);
    await second.getByText(/Hóa đơn lập từ 2026-11-22 đến 2026-11-22/).waitFor();
    assert.ok(await second.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'date controls fit mobile width');
    if (shots) await page.screenshot({ path: path.join(shots, 'product-drawer-custom-dates-mobile.png') });
    await page.keyboard.press('Escape');
    await second.waitFor({ state: 'detached' });
    assert.equal(await pageFilter.getByRole('button', { name: '90 ngày', exact: true }).getAttribute('aria-pressed'), 'true', 'product dates do not silently change the main report');

    // The same controls filter the whole report, including its daily trend/export snapshot.
    await pageFilter.getByLabel('Chọn thời gian').selectOption('month');
    await pageFilter.getByLabel('Tháng', { exact: true }).fill('2026-11');
    assert.equal(await pageFilter.getByLabel('Tháng', { exact: true }).getAttribute('max'), '2026-11');
    const overviewMonth = filteredResponse('product-invoice-insights', { start: '2026-11-01', end: '2026-11-22' });
    await pageFilter.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await overviewMonth;
    const overviewDay = filteredResponse('product-invoice-insights', { period: 'day', start: '2026-11-01', end: '2026-11-22' });
    await pageFilter.getByRole('button', { name: 'Theo Ngày', exact: true }).click();
    await overviewDay;
    await page.getByText('Sản phẩm bán chạy', { exact: true }).waitFor();

    await pageFilter.getByRole('button', { name: 'Xóa ngày', exact: true }).click();
    assert.equal(await pageFilter.getByLabel('Chọn thời gian').inputValue(), 'month');
    assert.equal(await pageFilter.getByLabel('Tháng', { exact: true }).inputValue(), '');

    // Chart dates are independent: only one extra read, no reload of the overview or stock lists.
    const invoiceTrend = page.getByRole('region', { name: 'Xu hướng hóa đơn', exact: true });
    const stockReads = stockRequests.length, beforeTrend = insightsRequests.length;
    const mainTotal = await page.locator('[class*="metricsGrid"]').first().innerText();
    await invoiceTrend.getByLabel('Chọn thời gian').selectOption('month');
    await invoiceTrend.getByLabel('Tháng', { exact: true }).fill('2026-02');
    const chartMonth = filteredResponse('product-invoice-insights', { period: 'day', start: '2026-02-01', end: '2026-02-28' });
    await invoiceTrend.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await chartMonth;
    await invoiceTrend.locator('svg[role="img"]').waitFor();
    assert.equal(insightsRequests.length, beforeTrend + 1);
    assert.equal(stockRequests.length, stockReads);
    assert.equal(await page.locator('[class*="metricsGrid"]').first().innerText(), mainTotal);
    assert.equal(await pageFilter.getByLabel('Chọn thời gian').inputValue(), 'month');
    assert.equal(await pageFilter.getByLabel('Tháng', { exact: true }).inputValue(), '');
    const chartMonthly = filteredResponse('product-invoice-insights', { period: 'month', start: '2026-02-01', end: '2026-02-28' });
    await invoiceTrend.getByRole('button', { name: 'Theo Tháng', exact: true }).click();
    await chartMonthly;
    await invoiceTrend.getByRole('heading', { name: /theo Tháng/ }).waitFor();
    const beforeChartClear = insightsRequests.length;
    await invoiceTrend.getByRole('button', { name: 'Xóa ngày', exact: true }).click();
    assert.equal(await invoiceTrend.getByLabel('Tháng', { exact: true }).inputValue(), '');
    assert.equal(insightsRequests.length, beforeChartClear);
    assert.equal(await pageFilter.getByRole('button', { name: 'Theo Ngày', exact: true }).getAttribute('aria-pressed'), 'true');

    assert.deepEqual(errors, []);
    console.log('product-insights e2e: ok');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });

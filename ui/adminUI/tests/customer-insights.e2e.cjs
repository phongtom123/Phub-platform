// Every API is a fixture. Writes are forbidden; no Supabase credentials are used.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_URL || 'http://127.0.0.1:3000';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function report(scope, period = 'month') {
  const active = scope === 'ACTIVE';
  const categories = active ? [
    { category_id:'CPU', category_name:'CPU Fixture', quantity_sold:1, revenue:'9000000.00', percentage:90.9 },
    { category_id:'MOUSE', category_name:'Mouse Fixture', quantity_sold:9, revenue:'900000.00', percentage:9.1 },
  ] : [];
  return {
    summary:{ status_scope:scope, total_customers:1, active_buyers:active?1:0, total_orders:active?1:0, total_revenue:active?'9900000.00':'0.00', aov:active?'9900000.00':'0.00', arpu:active?'9900000.00':'0.00' },
    demographics:{ gender:[{label:'Nam',value:0,percentage:0},{label:'Nữ',value:1,percentage:100}], age_groups:[{group:'25 - 34',value:1,percentage:100}], interests:[] },
    spending_trends:{ period_type:period, timeline:[], customer_segments:[] },
    product_insights:{ top_categories:categories, top_products:[] },
    survey_insights:{ total_surveys:0,total_responses:0,rated_responses:0,total_ratings:0,avg_overall_score:null,avg_product_score:null,avg_service_score:null,rating_breakdown:[],recent_feedbacks:[] },
    strategic_recommendations:[], city_distribution:[],
  };
}

async function setup(browser, analytics) {
  const context = await browser.newContext({ viewport:{width:1500,height:1100}, acceptDownloads:true });
  const errors = [];
  await context.route('**/api/backend/**', async route => {
    assert.equal(route.request().method(),'GET','All writes are forbidden');
    const url = new URL(route.request().url()), path = url.pathname.replace('/api/backend/','');
    if (path === 'auth/me') return route.fulfill({json:{ account_id:'AD-FIXTURE',username:'fixture',role:'ADMIN',name:'Admin Fixture',employee_id:'NV-FIXTURE',warehouse_id:null,customer_id:null }});
    if (path === 'crm/analytics/customer-insights') return analytics(route,url);
    if (path === 'data/resources') return route.fulfill({json:[]});
    return route.fulfill({json:{data:[],total:0,page:1,page_size:100}});
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base+'/customer-insights',{waitUntil:'domcontentloaded'});
  await page.locator('[class*="metricCard"]').first().waitFor();
  return {page,context,errors};
}

function completedRevenue(page) {
  return page.locator('[class*="metricCard"]').filter({has:page.getByText('Doanh thu (Đơn hoàn thành)',{exact:true})}).locator('[class*="metricValue"]');
}
async function downloadCSV(page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button',{name:'Xuất CSV',exact:true}).click();
  const stream = await (await pending).createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    let hold = false;
    const started = deferred(), release = deferred(), fulfilled = deferred();
    const first = await setup(browser, async (route,url) => {
      const scope = url.searchParams.get('status_scope'), period = url.searchParams.get('period');
      if (hold && scope === 'ACTIVE') {
        started.resolve();
        await release.promise;
        await route.fulfill({json:report(scope,period)});
        fulfilled.resolve();
        return;
      }
      return route.fulfill({json:report(scope,period)});
    });
    const {page} = first;
    const chart = page.locator('[class*="pieCardBlock"]').filter({has:page.getByRole('heading',{name:'3. Thị hiếu Ngành hàng (Tất cả)',exact:true})});
    const cpu = chart.locator('[class*="pieLegendRow"]').filter({hasText:'CPU Fixture'});
    assert.match(await cpu.innerText(),/10%/);
    assert.doesNotMatch(await cpu.innerText(),/90\.9%/);
    await cpu.hover();
    assert.deepEqual(await chart.locator('svg text').allTextContents(),['1','10%']);
    const activeCSV = await downloadCSV(page);
    assert(activeCSV.includes('Số đơn có hiệu lực,1'));
    assert(!activeCSV.includes('Số đơn hoàn thành'));
    console.log('PASS: category chart and CSV use the correct quantities/scope.');

    hold = true;
    await page.getByRole('button',{name:'Làm mới',exact:true}).click();
    await started.promise;
    assert(await page.getByRole('button',{name:'Xuất CSV',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Chỉ đơn hoàn thành',exact:true}).click();
    await completedRevenue(page).filter({hasText:/^0 đ$/}).waitFor();
    await page.getByRole('button',{name:'Theo Quý',exact:true}).click();
    await completedRevenue(page).filter({hasText:/^0 đ$/}).waitFor();
    release.resolve();
    await fulfilled.promise;
    const latestCSV = await downloadCSV(page);
    assert(latestCSV.includes('Phạm vi,Chỉ đơn hoàn thành'));
    assert(latestCSV.includes('Kỳ tổng hợp,Theo quý'));
    assert(latestCSV.includes('Số đơn hoàn thành,0'));
    assert(!latestCSV.includes('9900000.00'));
    assert.deepEqual(first.errors,[]);
    await first.context.close();
    console.log('PASS: a delayed refresh cannot overwrite newer scope/period or CSV.');

    let fail = false, wrongScope = false;
    const second = await setup(browser, async (route,url) => {
      if (fail) return route.fulfill({status:503,json:{detail:'Fixture report failure'}});
      const scope = wrongScope ? 'ACTIVE' : url.searchParams.get('status_scope');
      return route.fulfill({json:report(scope,url.searchParams.get('period'))});
    });
    fail = true;
    await second.page.getByRole('button',{name:'Chỉ đơn hoàn thành',exact:true}).click();
    await second.page.getByText('Fixture report failure',{exact:true}).waitFor();
    assert(await second.page.getByRole('button',{name:'Xuất CSV',exact:true}).isDisabled());
    assert.equal(await second.page.locator('[class*="metricCard"]').count(),0);
    fail = false; wrongScope = true;
    await second.page.getByRole('button',{name:'Làm mới',exact:true}).click();
    await second.page.getByText(/API trả về báo cáo không khớp phạm vi hoặc kỳ/).waitFor();
    assert(await second.page.getByRole('button',{name:'Xuất CSV',exact:true}).isDisabled());
    wrongScope = false;
    await second.page.getByRole('button',{name:'Làm mới',exact:true}).click();
    await completedRevenue(second.page).filter({hasText:/^0 đ$/}).waitFor();
    assert((await downloadCSV(second.page)).includes('Số đơn hoàn thành,0'));
    assert.deepEqual(second.errors,[]);
    await second.context.close();
    console.log('PASS: failures and mismatched API reports cannot export stale data; retry recovers.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

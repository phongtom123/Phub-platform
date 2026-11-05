// Exercise hydration with and without an extension changing the document element.
// All application API reads are intercepted. No database or login writes.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3001';

(async()=>{
  const browser = await chromium.launch({
    headless:true,
    executablePath:process.env.PHUB_CHROMIUM_PATH || undefined,
    // Current Chrome otherwise blocks the intercepted localhost document's HMR
    // connection and delays hydration. This flag is only for this test browser.
    args:['--disable-features=LocalNetworkAccessChecks'],
  });
  try {
    for (const mutation of ['none','root','child']) {
      const context = await browser.newContext(), page = await context.newPage();
      const hydration = [], errors = [];
      page.on('console',message=>{if(/hydrat|server rendered|didn.t match/i.test(message.text()))hydration.push(message.text());});
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/api/**',route=>{
        assert.equal(route.request().method(),'GET');
        if(new URL(route.request().url()).pathname.endsWith('/auth/me'))return route.fulfill({status:401,json:{detail:'Not signed in'}});
        return route.fulfill({json:{items:[],pagination:{page:1,page_size:8,total:0,total_pages:0}}});
      });
      if (mutation !== 'none') await page.route('**/main/landing',async route=>{
        const response = await route.fetch(), original = await response.text();
        const body = mutation === 'root'
          ? original.replace(/(<html\b[^>]*class=")/,'$1mdl-js ')
          : original.replace('<main class="flex-1">','<main class="flex-1" data-hydration-probe="changed">');
        assert.notEqual(body,original,'fixture must modify the intended element');
        await route.fulfill({response,body});
      });
      const response = await page.goto(`${base}/main/landing`,{waitUntil:'domcontentloaded'});
      const serverHtml = await response.text();
      await page.waitForFunction(()=>Object.keys(document).some(key=>key.startsWith('__reactContainer')));
      // Allow hydration diagnostics and initial effects to finish.
      await page.waitForTimeout(600);
      const classes = await page.locator('html').getAttribute('class');
      assert.equal(await page.locator('html').getAttribute('lang'),'vi');
      assert.ok(classes.includes('geist_')&&classes.includes('geist_mono_')&&classes.includes('poppins_'),'keep existing font variables');
      if (mutation === 'none') assert.equal(/<html\b[^>]*class="([^"]*)"/.exec(serverHtml)[1],classes,'font classes are deterministic');
      if (mutation === 'root') assert.ok(classes.split(/\s+/).includes('mdl-js'),'do not strip extension classes');
      if (mutation === 'child') assert.ok(hydration.some(message=>message.includes('data-hydration-probe')),'page content mismatches must still be reported');
      else assert.deepEqual(hydration,[],`${mutation}: root attributes must not trigger a hydration warning`);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log('PASS: stable SSR fonts, extension-mutated html supported, nested hydration checks retained');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

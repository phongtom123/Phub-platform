/* One focused report flow with mocked APIs. No live data or database changes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_TEST_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});
  try {
    const context = await browser.newContext(), page = await context.newPage();
    const errors = []; page.on('pageerror', error=>errors.push(error.message));
    const reads = []; let wrongPeriod = false, incomplete = false;
    await page.route('**/api/backend/**', async route=>{
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api/backend/','');
      const json = (body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      assert.equal(request.method(),'GET','report must never write data');
      if (endpoint==='auth/me') return json({account_id:'A',username:'admin',role:'ADMIN',name:'Admin',employee_id:'NV1',warehouse_id:null,customer_id:null});
      if (endpoint==='data/resources') return json([]);
      if (endpoint==='admin/operations/business-report') {
        const start=url.searchParams.get('start'),end=url.searchParams.get('end');reads.push({start,end});
        const count=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
        const data={start:wrongPeriod?'2000-01-01':start,end,method:'MOVING_WEIGHTED_AVERAGE',basis:'COMPLETED_ORDERS',net_revenue:'1250000.00',tax:'125000.00',discounts:'50000.00',gross_revenue:'1375000.00',collected:'900000.00',refunds:'0.00',order_count:1,quantity:2,cost:'1000000.00',known_cost:'1000000.00',gross_profit:'250000.00',margin:'20.00',costed_lines:1,total_lines:1,warnings:[],products:[{sku:'CPU1',name:'CPU demo',quantity:2,net_revenue:'1250000.00',cost:'1000000.00',gross_profit:'250000.00',margin:'20.00',unpriced_lines:0}],daily:Array.from({length:count},(_,i)=>({day:new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10),net_revenue:i===0?'1250000.00':'0.00',gross_profit:i===0?'250000.00':'0.00'}))};
        if(incomplete){Object.assign(data,{cost:null,gross_profit:null,margin:null,costed_lines:0,known_cost:'0.00',warnings:['INCOMPLETE_COST_HISTORY']});data.products[0]={...data.products[0],cost:null,gross_profit:null,margin:null,unpriced_lines:1};data.daily[0].gross_profit=null;}
        return json(data);
      }
      return json({data:[],total:0,page:1,page_size:20});
    });
    await page.goto(`${base}/reports?start=2026-10-01&end=2026-10-30`);
    await page.getByRole('heading',{name:'Báo cáo kinh doanh',exact:true}).waitFor();
    const financial = page.getByRole('region',{name:'Số liệu kinh doanh',exact:true});
    await financial.getByText('1.250.000 ₫',{exact:true}).first().waitFor();
    await financial.getByText('250.000 ₫',{exact:true}).first().waitFor();
    await financial.getByText('20,00%',{exact:true}).first().waitFor();
    assert.equal(await page.getByText('Chưa xác định',{exact:true}).count(),0);
    await page.getByRole('region',{name:'Công thức báo cáo'}).waitFor();
    const downloaded = page.waitForEvent('download');
    await financial.getByRole('button',{name:'Xuất báo cáo CSV',exact:true}).click();
    const download=await downloaded;
    assert.equal(download.suggestedFilename(),'phub-kinh-doanh-2026-10-01-2026-10-30.csv');
    const csv=fs.readFileSync(await download.path(),'utf8');
    assert.ok(csv.includes('Bình quân gia quyền liên hoàn')&&csv.includes('1250000.00')&&csv.includes('CPU demo'));
    assert.ok(csv.includes('Lợi nhuận gộp')&&csv.includes('250000.00'));
    await page.getByRole('button',{name:'Theo ngày',exact:true}).click();
    await financial.getByRole('columnheader',{name:'Ngày hoàn thành',exact:true}).waitFor();
    await page.getByRole('button',{name:'Theo sản phẩm',exact:true}).click();
    await page.getByLabel('Tìm SKU hoặc tên sản phẩm trong báo cáo').fill('CPU1');
    assert.equal(await financial.locator('tbody tr').count(),1);
    await page.getByLabel('Từ ngày',{exact:true}).fill('2026-09-01');
    await page.getByLabel('Đến ngày',{exact:true}).fill('2026-09-30');
    await page.getByRole('button',{name:'Xem báo cáo',exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get('start')==='2026-09-01');
    await financial.getByText('2026-09-01 → 2026-09-30 · theo ngày hoàn thành đơn, giờ Việt Nam',{exact:true}).waitFor();
    assert.deepEqual(reads.at(-1),{start:'2026-09-01',end:'2026-09-30'});
    const before=reads.length;
    await page.getByLabel('Từ ngày',{exact:true}).fill('2024-01-01');
    await page.getByRole('button',{name:'Xem báo cáo',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'tối đa 366 ngày'}).waitFor();
    assert.equal(reads.length,before,'invalid date range must not call the API');
    wrongPeriod=true;
    await page.getByRole('button',{name:'Làm mới báo cáo',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'API chưa xác nhận đúng kỳ báo cáo'}).waitFor();
    assert.equal(await financial.count(),0,'wrong-period data must not be displayed or exported');
    wrongPeriod=false;
    await page.getByRole('button',{name:'Thử lại',exact:true}).click();
    await financial.waitFor();
    incomplete=true;
    await page.getByRole('button',{name:'Làm mới báo cáo',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Chưa đủ lịch sử giá vốn'}).waitFor();
    assert.ok(await financial.getByText('Chưa đủ dữ liệu',{exact:true}).count()>=2,'unknown cost must not become zero profit');
    incomplete=false;
    await page.getByRole('button',{name:'Làm mới báo cáo',exact:true}).click();
    await financial.getByText('250.000 ₫',{exact:true}).first().waitFor();
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'report must fit a mobile viewport');
    await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-reports-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: revenue/cost/profit/margin, product/day tables, CSV, period filter, invalid range, wrong-period rejection, mobile layout');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

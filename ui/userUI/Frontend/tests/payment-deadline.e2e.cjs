// Browser fixtures; no live orders or payments are created.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3001';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage(), errors = [], writes = [];
      page.on('pageerror', e => errors.push(e.message));
      let mode = 'awaiting_payment', due = Date.now() + 86400000, reads = 0;
      const deadline = () => mode === 'legacy' ? null : ({ expires_at: new Date(due).toISOString(), server_now: new Date().toISOString(),
        expired_at: mode === 'expired' ? new Date().toISOString() : null, status: mode });
      const order = () => ({ id: 'DEADLINE-TEST', status: mode === 'expired' ? 'HUY' : 'MOI', created_at: '2026-11-04T07:00:00Z',
        currency: 'VND', total: '100.00', recipient: {name:'Test',phone:null,address_line:null,province:null,ward:null}, note:null,
        items:[{sku:'TEST',warehouse_id:1,name:'Test product',unit:'unit',quantity:1,unit_price:'100.00',discount:'0.00',tax_amount:'0.00',line_total:'100.00'}], payment_deadline:deadline() });
      await page.route('**/api/**', route => {
        const p = new URL(route.request().url()).pathname;
        if (route.request().method() !== 'GET') writes.push(p);
        const ok = json => route.fulfill({ json });
        if (p.endsWith('/auth/me')) return ok({account_id:'A',username:'test',role:'KHACH_HANG',name:'Test',customer_id:'C',employee_id:null,warehouse_id:null});
        if (p.endsWith('/customer/me')) return ok({customer_id:'C',name:'Test',phone:null,address_line:null,province:null,ward:null});
        if (p.endsWith('/customer/addresses')) return ok({items:[],item:null});
        if (p.startsWith('/api/catalog/')) return ok({items:[]});
        if (p.endsWith('/customer/orders')) return ok({items:[order()],pagination:{page:1,page_size:10,total:1,total_pages:1}});
        if (p.endsWith('/orders/DEADLINE-TEST')) { reads++; return ok(order()); }
        if (p.endsWith('/invoice')) return ok({order_id:'DEADLINE-TEST',currency:'VND',invoice:{issued_at:'2026-11-04T07:00:00Z',subtotal:'100.00',discount_total:'0.00',tax_total:'0.00',total:'100.00'},items:[],payment_deadline:deadline()});
        if (p.endsWith('/payments')) return ok({order_id:'DEADLINE-TEST',currency:'VND',latest_transaction:null,message:'No payment'});
        if (p.endsWith('/transactions')) return ok({order_id:'DEADLINE-TEST',currency:'VND',items:[],pagination:{page:1,page_size:10,total:0,total_pages:0}});
        throw new Error(`Unexpected request ${p}`);
      });
      await page.goto(base + '/main/orders/DEADLINE-TEST');
      const notice = page.getByRole('status', {name:'Hạn thanh toán'});
      await notice.getByText('Thanh toán trong vòng 24 giờ', {exact:true}).waitFor().catch(async e => {
        console.error(await page.locator('body').innerText()); console.error(errors); throw e;
      });
      assert.match(await notice.innerText(), /Còn (23:59|24:00)/);
      assert.ok(await page.getByRole('button',{name:'Yêu cầu thanh toán',exact:true}).isVisible());
      const bounds = await notice.boundingBox(); assert.ok(bounds.x + bounds.width <= width + 1);
      if (width === 1440) await page.screenshot({path:process.env.TEMP + '/phub-payment-deadline.png',fullPage:true});
      due = Date.now() + 2000;
      await page.getByRole('button',{name:'Cập nhật hóa đơn'}).click();
      await notice.getByText('Đã hết hạn thanh toán',{exact:true}).waitFor({timeout:12000});
      assert.equal(await page.getByRole('button',{name:'Yêu cầu thanh toán',exact:true}).count(),0);
      mode = 'expired';
      await page.getByRole('button',{name:'Cập nhật hóa đơn'}).click();
      await page.getByText('Đơn đã tự hủy do quá hạn thanh toán',{exact:true}).waitFor();
      const afterExpiry = reads;
      await page.waitForTimeout(1200);
      assert.ok(reads <= afterExpiry + 1, 'expired mounts do not cause an infinite order reload loop');
      mode = 'payment_received';
      await page.getByRole('button',{name:'Cập nhật hóa đơn'}).click();
      await notice.getByText('Đã ghi nhận khoản thu',{exact:true}).waitFor();
      await notice.getByText(/thanh toán một phần/).waitFor();
      mode = 'legacy';
      await page.getByRole('button',{name:'Cập nhật hóa đơn'}).click();
      await notice.waitFor({state:'detached'});
      mode = 'awaiting_payment'; due = Date.now() + 86400000;
      await page.goto(base + '/main/profile');
      await page.getByRole('navigation',{name:'Quản lý tài khoản'}).getByRole('button',{name:'Đơn hàng của tôi',exact:true}).click();
      await page.getByRole('status',{name:'Hạn thanh toán'}).getByText('Thanh toán trong vòng 24 giờ',{exact:true}).waitFor();
      assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
      console.log(`PASS ${width}px: countdown, expiry blocks payment, cancellation refresh without loop, partial receipt, legacy invoices`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e);process.exitCode=1; });

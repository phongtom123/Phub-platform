// Every API request is mocked. Never cancel a real customer's order.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://127.0.0.1:3001';
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const session = {account_id:'TK_TEST',username:'test.customer',role:'KHACH_HANG',name:'Khách kiểm thử',customer_id:'KH_TEST'};
    const profile = {customer_id:'KH_TEST',name:session.name,phone:null,address_line:null,province:null,ward:null};
    const records = ['MOI','XAC_NHAN','DANG_CHUAN_BI','DA_XUAT_KHO','HOAN_THANH','HUY','MOI'].map((status,i) =>
      ({id:'ORDER-'+i,status,created_at:`2026-11-${String(9-i).padStart(2,'0')}T01:00:00Z`,currency:'VND',total:'100000.00'}));
    const errors=[], writes=[], reads=[];
    let fail=true, release;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin!==new URL(base).origin)return route.abort();
      if(!url.pathname.startsWith('/api/'))return route.continue();
      const ok=body=>route.fulfill({json:body});
      if(url.pathname.endsWith('/auth/me'))return ok(session);
      if(url.pathname==='/api/backend/customer/me'||url.pathname==='/api/customer/me')return ok(profile);
      if(url.pathname.endsWith('/customer/addresses')||url.pathname==='/api/customer/addresses')return ok({items:[],item:null});
      if(url.pathname==='/api/backend/customer/orders'){
        assert.equal(req.method(),'GET'); reads.push(url.search);
        const size=Number(url.searchParams.get('page_size')),pageNumber=Number(url.searchParams.get('page'));
        return ok({items:records.slice((pageNumber-1)*size,pageNumber*size).toReversed(),pagination:{page:pageNumber,page_size:size,total:records.length,total_pages:Math.ceil(records.length/size)}});
      }
      if(url.pathname==='/api/customer/orders/ORDER-0/cancel'){
        assert.equal(req.method(),'POST');writes.push(req.postDataJSON());
        if(fail)return route.fulfill({status:503,json:{error:{code:'DATA_SERVICE_UNAVAILABLE',message:'Không thể hủy lúc này.'}}});
        await new Promise(resolve=>{release=resolve;}); records[0].status='HUY';
        return ok({...records[0],items:[{sku:'SKU_TEST',warehouse_id:1,name:'Fixture product',unit:'Cái',quantity:1,unit_price:'100000.00',discount:'0.00',tax_amount:'0.00',line_total:'100000.00'}],recipient:{name:null,phone:null,address_line:null,province:null,ward:null},note:null});
      }
      if(url.pathname.startsWith('/api/catalog/'))return ok({items:[]});
      throw Error('Unexpected API: '+req.method()+' '+url.pathname);
    });
    await page.goto(base+'/main/profile');
    const recent=page.getByRole('region',{name:'Đơn hàng gần đây',exact:true});
    let first=recent.getByRole('article',{name:'Đơn ORDER-0',exact:true});
    await first.waitFor();
    assert.equal(await recent.getByRole('article').count(),5);
    assert.deepEqual(await recent.getByRole('article').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),Array.from({length:5},(_,i)=>'Đơn ORDER-'+i));
    assert.ok(reads.some(q=>q.includes('page_size=5')));
    assert.equal(await recent.getByRole('button',{name:'Hủy đơn hàng',exact:true}).count(),0,'Compact preview has no cancel action');
    await recent.scrollIntoViewIfNeeded();
    await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-recent-orders-desktop.png')});
    await recent.getByRole('button',{name:'Xem tất cả đơn hàng →',exact:true}).click();
    const all=page.getByRole('region',{name:'Đơn hàng của tôi',exact:true});
    first=all.getByRole('article',{name:'Đơn ORDER-0',exact:true});
    const button=first.getByRole('button',{name:'Hủy đơn hàng',exact:true});
    await button.waitFor();
    assert.deepEqual(await button.evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.borderTopColor,s.color];}),['rgb(255, 255, 255)','rgb(220, 38, 38)','rgb(220, 38, 38)']);
    page.once('dialog',d=>d.dismiss()); await button.click(); assert.equal(writes.length,0);
    page.on('dialog',d=>d.accept()); await button.click();
    await first.getByRole('alert').getByText('Không thể hủy lúc này.',{exact:true}).waitFor();
    assert.equal(await button.count(),1,'Failed cancellation keeps the order cancellable');
    fail=false; await button.click();
    await first.getByRole('button',{name:'Đang hủy đơn…',exact:true}).waitFor();
    assert.ok(await first.getByRole('button',{name:'Đang hủy đơn…',exact:true}).isDisabled());
    assert.equal(writes.length,2);
    release(); await first.getByText('Đã hủy',{exact:true}).waitFor();
    assert.equal(await first.getByRole('button',{name:'Hủy đơn hàng',exact:true}).count(),0);
    await all.getByRole('article',{name:'Đơn ORDER-6',exact:true}).waitFor();
    assert.equal(await all.getByRole('article').count(),7);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile has no page overflow');
    assert.deepEqual(errors,[]);
    console.log('PASS: five recent orders, newest-first ordering, red inline cancellation, dismissed confirmation, error/retry, single pending write, cancelled state, full history and mobile layout.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

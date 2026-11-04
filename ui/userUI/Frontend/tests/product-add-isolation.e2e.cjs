// Delayed HTTP fixtures only: no live order, payment or inventory writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3001';
const products = ['A', 'B'].map(id => ({ id, sku:id, name:`Product ${id}`, is_active:true,
  price:'100000.00',currency:'VND',category:{id:'PC',name:'PC'},subcategory:{id:'CUSTOM',name:'Custom'},
  brand:'PHUB',description:null,unit:'unit',warranty_months:12,images:[],specifications:[],specifications_text:null }));
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome',args:['--disable-features=LocalNetworkAccessChecks']});
  try {
    for (const [pathname,width,authenticated] of [['/main/landing',1440,false],['/main/product',1440,false],['/main/product',390,false],['/main/product',1440,true]]) {
      const context = await browser.newContext({viewport:{width,height:1000}});
      let release, held = false, hold = true, productReads = 0;
      const gate = new Promise(resolve => {release=resolve;});
      try {
        const page = await context.newPage(), errors = [], writes = [];
        page.on('pageerror', error => errors.push(error.message));
        const cartKey = authenticated ? 'phub-cart-v1:C' : 'phub-cart-guest-v1';
        await page.route('**/api/**',async route => {
          const req = route.request(), url = new URL(req.url()), p=url.pathname;
          if(req.method()!=='GET') writes.push(p);
          const ok=json=>route.fulfill({json});
          if(p.endsWith('/auth/me')) return authenticated ? ok({account_id:'AC',username:'test',role:'KHACH_HANG',name:'Test',customer_id:'C',employee_id:null,warehouse_id:null}) : route.fulfill({status:401,json:{error:{message:'Guest'}}});
          if(p.endsWith('/customer/me')) return authenticated ? ok({customer_id:'C',name:'Test',phone:null,address_line:null,province:null,ward:null}) : route.fulfill({status:401,json:{error:{message:'Guest'}}});
          if(p==='/api/catalog/purchase-states') return ok({items:products.filter(p=>url.searchParams.getAll('sku').includes(p.sku)).map(p=>({id:p.id,sku:p.sku,is_active:true,available_quantity:20}))});
          if(p.match(/\/products\/[^/]+\/availability$/)) {
            const id=p.split('/').at(-2);
            return ok({id,sku:id,quantity:Number(url.searchParams.get('quantity')),available:true,is_active:true});
          }
          if(p==='/api/catalog/availability') return ok({items:products.map(item=>({sku:item.sku,available_quantity:20})),currency:'VND',tax_rate:'10.00'});
          if(p==='/api/catalog/products') return ok({items:products,pagination:{page:1,page_size:20,total:2,total_pages:1}});
          if(p.startsWith('/api/catalog/products/')) {
            const id=p.split('/').at(-1);
            if(id==='A') {productReads++; if(hold) {held=true; await gate;}}
            return ok(products.find(item=>item.id===id));
          }
          if(p.endsWith('/categories')) return ok({items:[{id:'PC',name:'PC',children:[{id:'CUSTOM',name:'Custom'}]}]});
          if(p.endsWith('/facets')) return ok({specs:[],brands:[],total:2});
          return ok({items:[]});
        });
        await page.goto(base+pathname);
        const region = pathname.includes('landing') ? page.locator('main') : page.locator(width<760?'#homepage2-results':'#catalog-results');
        const card = name => region.getByRole('article').filter({has:page.getByRole('link',{name,exact:true})}).first();
        const a=card('Product A'),b=card('Product B');
        const buyA=a.getByRole('button',{name:'Mua ngay',exact:true}), buyB=b.getByRole('button',{name:'Mua ngay',exact:true});
        await buyA.click();
        await a.getByRole('button',{name:'Đang thêm…',exact:true}).waitFor();
        assert.equal(held,true);
        assert.ok(await buyB.isEnabled(),'an unrelated product stays enabled while A is waiting');
        assert.equal(await b.getByText('Đang thêm…',{exact:true}).count(),0);
        await b.getByRole('button',{name:'Thêm vào giỏ',exact:true}).click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'[]').some(item=>item.sku==='B'&&item.quantity===1),cartKey);
        assert.ok(await a.getByRole('button',{name:'Đang thêm…',exact:true}).isDisabled());
        assert.equal(new URL(page.url()).pathname,pathname,'only A owns buy-now navigation');
        assert.equal(productReads,1,'no duplicate request for the pending product');
        hold=false; release();
        await page.waitForURL(url=>url.pathname==='/cart');
        const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'[]'),cartKey);
        assert.deepEqual(stored.map(item=>[item.sku,item.quantity]).sort(),[['A',1],['B',1]],'parallel products preserve both cart updates');
        assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
        console.log(`PASS ${pathname} ${width}px ${authenticated?'signed-in':'guest'}: only selected product busy; another product adds during delay; both quantities survive; buy-now opens cart`);
      } finally {release(); await context.close();}
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

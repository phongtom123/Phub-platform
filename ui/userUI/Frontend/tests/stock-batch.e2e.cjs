// Local browser fixtures only; no accounts, orders, payments or inventory writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3001';
const products = Array.from({length:20}, (_,i) => ({id:`P${i}`, sku:`SKU${i}`, name:`Product ${i}`,
  is_active:true, price:'100.00', currency:'VND', category:{id:'PC',name:'PC'},
  subcategory:{id:'SC',name:'Custom'}, brand:null, description:null, unit:'unit',
  warranty_months:12, images:[], specifications:[]}));
(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome', args:['--disable-features=LocalNetworkAccessChecks']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const batches = [], actions = [], errors = [];
    let allowAdd = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const request = route.request(), url = new URL(request.url()), p = url.pathname;
      const ok = json => route.fulfill({json});
      assert.equal(request.method(),'GET');
      if (p.endsWith('/me')) return route.fulfill({status:401,json:{error:{message:'Guest'}}});
      if (p === '/api/catalog/purchase-states') {
        const skus = url.searchParams.getAll('sku'); batches.push(skus);
        return ok({items:skus.map(sku => ({id:products.find(p => p.sku===sku).id,sku,is_active:true,available_quantity:50}))});
      }
      if (/\/products\/[^/]+\/availability$/.test(p)) {
        const id=p.split('/').at(-2), quantity=Number(url.searchParams.get('quantity'));
        actions.push({id,quantity});
        return ok({id,sku:products.find(p=>p.id===id).sku,quantity,available:allowAdd,is_active:true});
      }
      if (p==='/api/catalog/products') return ok({items:products,pagination:{page:1,page_size:20,total:20,total_pages:1}});
      if (p.startsWith('/api/catalog/products/')) return ok(products.find(item=>item.id===p.split('/').at(-1)));
      if (p.endsWith('/categories')) return ok({items:[{id:'PC',name:'PC',children:[{id:'SC',name:'Custom'}]}]});
      if (p.endsWith('/facets')) return ok({specs:[],brands:[],total:20});
      if (p==='/api/catalog/availability') return ok({items:products.map(p=>({sku:p.sku,available_quantity:50})),currency:'VND',tax_rate:'10.00'});
      return ok({items:[]});
    });
    await page.goto(base+'/main/product');
    await page.waitForFunction(()=>document.querySelectorAll('#catalog-results article button:not([disabled])').length>=40);
    await page.waitForTimeout(100);
    assert.equal(batches.length,1,'20 cards share one initial stock request, including dev StrictMode');
    assert.equal(batches[0].length,20);
    assert.equal(actions.length,0,'display never loads per-product availability');
    await page.waitForTimeout(15900);
    assert.equal(batches.length,2,'one shared refresh, not 20 timers');
    const first=page.locator('#catalog-results').getByRole('article').filter({has:page.getByRole('link',{name:'Product 0',exact:true})});
    await first.getByRole('button',{name:'Thêm vào giỏ',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Không đủ hàng'}).waitFor();
    assert.deepEqual(actions,[{id:'P0',quantity:1}],'cached positive display still requires a fresh action check');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('phub-cart-guest-v1')||'[]').length),0);
    allowAdd=true;
    await first.getByRole('button',{name:'Thêm vào giỏ',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('phub-cart-guest-v1')||'[]')[0]?.quantity===1);
    assert.equal(actions.length,2);
    assert.deepEqual(errors,[]);
    console.log('PASS: 20 cards -> 1 initial batch, 1 shared refresh; fresh add validation rejects stale stock; fixtures only');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

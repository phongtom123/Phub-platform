/** All API requests mocked; no live reviews or moderation writes. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_ADMIN_TEST_URL||'http://localhost:3001';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],calls=[],writes=[];
 const products=[{ma_sp:'A',sku:'SKU_A',ten_sp:'Laptop Alpha',review_count:3,average:2,low_count:2,low_rate:66.67,latest_at:'2026-11-09T01:00:00Z'},{ma_sp:'B',sku:'SKU_B',ten_sp:'Laptop Beta',review_count:9,average:4,low_count:0,low_rate:0,latest_at:'2026-11-09T01:00:00Z'}];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(base).origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  if(req.method()!=='GET'){writes.push(url.pathname);return route.fulfill({status:500,body:'Unexpected write'});}
  const respond=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname.endsWith('/auth/me'))return respond({account_id:'ADMIN',username:'admin',role:'ADMIN',name:'Admin'});
  if(url.pathname.endsWith('/data/resources'))return respond([]);
  if(url.pathname==='/api/backend/crm/report')return respond({as_of:'2026-11-09',total_customers:2,age_groups:[{label:'18–24',count:2}],review_stars:[],review_status:{pending:0,visible:12,hidden:0},interest_surveys:[]});
  if(url.pathname==='/api/backend/crm/review-insights'){
   calls.push(url);const minimum=Number(url.searchParams.get('min_reviews')||1),q=(url.searchParams.get('q')||'').toLowerCase();
   let rows=products.filter(p=>p.review_count>=minimum&&[p.ma_sp,p.sku,p.ten_sp].join(' ').toLowerCase().includes(q));
   if(url.searchParams.get('sort')==='MOST_REVIEWS')rows=rows.slice().sort((a,b)=>b.review_count-a.review_count);
   const reviews=rows.reduce((n,p)=>n+p.review_count,0),low=rows.reduce((n,p)=>n+p.low_count,0),product=products.find(p=>p.ma_sp===url.searchParams.get('product_id'));
   const lowOnly=url.searchParams.get('low_only')==='true';
   const comments=[1,2,3].filter(stars=>!lowOnly||stars<=2).map(stars=>({ma_danh_gia:`11111111-1111-4111-8111-${String(stars).padStart(12,'0')}`,so_sao:stars,author:'Khách thử nghiệm',noi_dung:stars<=2?'Máy gặp vấn đề khi sử dụng':'Nhận xét trung bình',ngay_tao:'2026-11-09T01:00:00Z',cap_nhat_luc:'2026-11-09T01:00:00Z'}));
   return respond({data:rows,total:rows.length,page:1,page_size:20,summary:{products:rows.length,reviews,average:reviews?rows.reduce((n,p)=>n+p.review_count*p.average,0)/reviews:null,low_count:low,low_rate:reviews?Math.round(low/reviews*10000)/100:0},details:product?{product,data:comments,total:comments.length,page:1,page_size:10,low_only:lowOnly}:null});
  }
  return respond({data:[],total:0,page:1,page_size:20});
 });
 await page.goto(base+'/crm-report');const report=page.getByRole('region',{name:'Phân tích đánh giá sản phẩm',exact:true});
 await report.getByRole('table').waitFor();assert.equal(await page.getByRole('link',{name:/Quản lý đánh giá/}).count(),0,'Admin report never links to staff moderation');
 const alpha=report.getByRole('row').filter({hasText:'Laptop Alpha'});
 assert.ok((await alpha.textContent()).includes('Ít đánh giá'));assert.ok((await alpha.textContent()).includes('66.67%'));
 await alpha.getByRole('button',{name:'Xem nhận xét'}).click();const comments=report.getByRole('region',{name:'Nhận xét sản phẩm đang chọn'});
 await comments.getByRole('heading',{name:'Nhận xét: Laptop Alpha'}).waitFor();assert.ok(await comments.getByRole('checkbox').isChecked());
 assert.equal(await comments.getByText('Nhận xét trung bình',{exact:true}).count(),0);
 await comments.getByRole('checkbox').uncheck();await comments.getByText('Nhận xét trung bình',{exact:true}).waitFor();
 await report.getByRole('combobox',{name:'Số đánh giá tối thiểu'}).selectOption('5');
 await report.getByRole('button',{name:'Áp dụng bộ lọc'}).click();await report.getByRole('table').waitFor();
 assert.equal(await report.getByRole('row').filter({hasText:'Laptop Alpha'}).count(),0);assert.equal(await comments.count(),0,'Changing cohort clears product drilldown');
 await report.getByRole('textbox',{name:'Tìm sản phẩm trong báo cáo'}).fill('SKU_B');await report.getByRole('button',{name:'Áp dụng bộ lọc'}).click();
 await report.getByRole('row').filter({hasText:'Laptop Beta'}).waitFor();
 await page.getByRole('button',{name:'Làm mới báo cáo',exact:true}).click();await report.getByRole('table').waitFor();
 assert.equal(await report.getByRole('combobox',{name:'Số đánh giá tối thiểu'}).inputValue(),'5');assert.equal(await report.getByRole('textbox',{name:'Tìm sản phẩm trong báo cáo'}).inputValue(),'SKU_B');
 await report.getByRole('textbox',{name:'Tìm sản phẩm trong báo cáo'}).fill('Không có');await report.getByRole('button',{name:'Áp dụng bộ lọc'}).click();
 await report.getByText('Không có sản phẩm đủ số đánh giá trong bộ lọc này.',{exact:true}).waitFor();assert.equal(await report.getByRole('table').count(),0);
 await report.getByRole('button',{name:'Bỏ lọc',exact:true}).click();await report.getByRole('table').waitFor();
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const sizing=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth,outer:[...document.querySelectorAll('main,section,form,header')].filter(el=>el.getBoundingClientRect().right>window.innerWidth+1).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,10)}));
 assert.ok(sizing.scroll<=sizing.width+1,'Mobile table scroll stays inside report: '+JSON.stringify(sizing));
 assert.ok(calls.some(url=>url.searchParams.get('product_id')==='A'&&url.searchParams.get('low_only')==='true'));
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('Review insights browser: product comparison, low-score drilldown, sample filter, refresh preservation, search, empty state and mobile layout passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

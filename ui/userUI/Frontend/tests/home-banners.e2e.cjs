// Browser fixtures only; no uploads, logins or database writes.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_USER_TEST_URL||'http://localhost:3001';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="738" height="333"><rect width="738" height="333" fill="#0156ff"/><text x="60" y="180" fill="white" font-size="48">PHUB Banner</text></svg>');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_PATH||undefined,args:['--disable-features=LocalNetworkAccessChecks']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let mode='single';
  await page.route('https://images.test/**',route=>mode==='broken'?route.fulfill({status:404,body:''}):route.fulfill({status:200,contentType:'image/svg+xml',body:decodeURIComponent(image.split(',')[1])}));
  await page.route('**/api/**',route=>{
   assert.equal(route.request().method(),'GET');
   const path=new URL(route.request().url()).pathname;
   if(path.endsWith('/auth/me'))return route.fulfill({status:401,json:{detail:'Not signed in'}});
   if(path.endsWith('/banners')){
    if(mode==='error')return route.fulfill({status:503,json:{error:{message:'Banner temporarily unavailable'}}});
    const banner={id:1,title:'Campaign One',alt_text:'Banner One',image_url:'https://images.test/banner1.webp',width:738,height:333};
    return route.fulfill({json:{items:mode==='empty'?[]:mode==='multiple'?[banner,{...banner,id:2,title:'Campaign Two',alt_text:'Banner Two',image_url:'https://images.test/banner2.webp'}]:[banner]}});
   }
   return route.fulfill({json:{items:[],pagination:{page:1,page_size:8,total:0,total_pages:0}}});
  });
  const open=()=>page.goto(`${base}/main/landing`,{waitUntil:'domcontentloaded'});
  const hero=page.getByRole('region',{name:'Banner quảng cáo',exact:true});
  await open();
  const first=hero.getByRole('img',{name:'Banner One',exact:true});
  await first.waitFor();await first.evaluate(img=>img.decode());
  async function assertBannerFits() {
   const imageBox=await first.boundingBox(),frame=await hero.boundingBox();
   const imageStyle=await first.evaluate(img=>({fit:getComputedStyle(img).objectFit,position:getComputedStyle(img).objectPosition}));
   const expectedRatio=page.viewportSize().width<=760?16/7:1398/328;
   assert.ok(Math.abs(imageBox.width-frame.width)<1,'image fills banner width');
   assert.ok(Math.abs(imageBox.height-frame.height)<1,'banner has no empty bands');
   assert.equal(imageStyle.fit,'cover','scale uniformly and crop excess image');
   assert.equal(imageStyle.position,'50% 50%','crop from the center');
   assert.ok(Math.abs(frame.width/frame.height-expectedRatio)<0.01,'banner frame follows the viewport, not source dimensions');
  }
  await assertBannerFits();
  assert.equal(await hero.getByRole('link').getAttribute('href'),'/main/product');
  assert.equal(await hero.getByRole('button').count(),0,'one banner needs no carousel controls');
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-home-banner-desktop.png'),fullPage:false});
  mode='multiple';await open();await first.waitFor();
  await hero.getByRole('button',{name:'Banner tiếp theo',exact:true}).click();
  await hero.getByRole('img',{name:'Banner Two',exact:true}).waitFor();
  await hero.getByRole('button',{name:'Banner trước',exact:true}).click();await first.waitFor();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'banner fits mobile');
  await first.evaluate(img=>img.decode());
  await assertBannerFits();
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-home-banner-mobile.png'),fullPage:false});
  mode='empty';await open();await page.waitForResponse(response=>response.url().includes('/api/catalog/banners')).catch(()=>{});
  await page.waitForFunction(()=>!document.querySelector('[aria-label="Banner quảng cáo"]'));
  mode='error';await open();await hero.getByText('Banner temporarily unavailable',{exact:true}).waitFor();
  mode='single';await hero.getByRole('button',{name:'Thử lại',exact:true}).click();await first.waitFor();
  mode='broken';await open();await hero.getByRole('button',{name:'Thử lại',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: real banner rendering, link, single/multiple controls, mobile, empty campaigns, retry and broken images');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

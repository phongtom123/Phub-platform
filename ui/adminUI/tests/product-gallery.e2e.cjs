/** Isolated browser test against the real Next UI; every backend/image request is intercepted. */
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://localhost:3000';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12,'0')}`;
const column = (name, extra={}) => ({name,type:'varchar',required:false,generated:false,immutable:false,default:null,choices:null,system:false,...extra});
const resource = {name:'products',title:'Sản phẩm',keys:['ma_sp'],writable:true,columns:[
  column('ma_sp',{required:true,immutable:true}),column('sku',{required:true,immutable:true}),column('ten_sp',{required:true}),column('duong_dan_anh'),
]};

async function main() {
  const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});
  try {
    const context=await browser.newContext();
    const page=await context.newPage(); const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    const rows={P:{ma_sp:'P',sku:'SKU',ten_sp:'Sản phẩm thử',duong_dan_anh:'/images/one.png'}};
    const galleries={P:{product_id:'P',legacy_url:'/images/one.png',images:[
      {media_id:id(1),url:'/images/one.png',alt_text:null,position:0,primary:true},
      {media_id:id(2),url:'/images/two.png',alt_text:null,position:1,primary:false},
    ]}};
    const uploaded=new Map(); let uploads=0, creates=0, patches=0, puts=0, failNext=true, navigations=0;
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())navigations++;});
    await page.route('**/images/*.png',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
    await page.route('**/api/backend/**',async route=>{
      const request=route.request(),url=new URL(request.url()),endpoint=url.pathname.replace('/api/backend/','');
      const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(endpoint==='auth/me')return json({account_id:'A',username:'admin',role:'ADMIN',name:'Admin',employee_id:'NV1',warehouse_id:null,customer_id:null});
      if(endpoint==='data/resources')return json([resource]);
      if(endpoint==='admin/media/images') {
        uploads++; const media_id=id(10+uploads),url=`${base}/images/upload-${uploads}.png`; uploaded.set(media_id,url);
        return json({media_id,url},201);
      }
      const galleryMatch=endpoint.match(/^admin\/media\/products\/([^/]+)\/images$/);
      if(galleryMatch) {
        const product=galleryMatch[1];
        if(request.method()==='GET')return json(galleries[product]||{product_id:product,legacy_url:null,images:[]});
        puts++; const body=request.postDataJSON();
        if(failNext){failNext=false;return json({detail:'Lỗi tạm thời: thử lưu lại'},503);}
        const previous=galleries[product]||{images:[],legacy_url:null};
        assert.deepEqual(body.expected_ids,previous.images.map(image=>image.media_id));
        assert.equal(body.expected_legacy_url,previous.legacy_url);
        const images=body.items.map((source,index)=>({media_id:source.media_id||id(90+index),url:source.url||uploaded.get(source.media_id)||previous.images.find(image=>image.media_id===source.media_id).url,alt_text:null,position:index,primary:index===0}));
        galleries[product]={product_id:product,legacy_url:images[0]?.url||null,images}; rows[product].duong_dan_anh=galleries[product].legacy_url;
        return json(galleries[product]);
      }
      if(endpoint==='data/products') {
        if(request.method()==='POST') {creates++; const body=request.postDataJSON(); rows[body.ma_sp]={...body,duong_dan_anh:null}; return json({data:[rows[body.ma_sp]]});}
        const key=JSON.parse(url.searchParams.get('key')||'["P"]')[0];
        if(request.method()==='PATCH'){patches++;Object.assign(rows[key],request.postDataJSON());}
        return json({data:[rows[key]],total:1,page:1,page_size:20,filters:{}});
      }
      return json({detail:'Unused test endpoint'},404);
    });
    const edit=`${base}/data/products?key=${encodeURIComponent('["P"]')}&edit=1`;
    await page.goto(edit);
    await page.getByRole('heading',{name:'Hình ảnh sản phẩm (2/20)',exact:true}).waitFor();
    const input=page.getByLabel('Chọn nhiều ảnh sản phẩm');
    assert.equal(await input.getAttribute('multiple'),'');
    await input.setInputFiles([{name:'three.png',mimeType:'image/png',buffer:png},{name:'four.png',mimeType:'image/png',buffer:png}]);
    await page.getByRole('heading',{name:'Hình ảnh sản phẩm (4/20)',exact:true}).waitFor();
    await page.getByLabel('Đặt ảnh 4 làm ảnh chính',{exact:true}).click();
    await page.getByLabel('Gỡ ảnh 2',{exact:true}).click();
    await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Lỗi tạm thời'}).waitFor();
    assert.equal(uploads,2); assert.equal(patches,0);
    await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
    assert.equal(uploads,2,'retry must reuse uploaded files'); assert.equal(puts,2);
    assert.deepEqual(galleries.P.images.map(image=>image.media_id),[id(11),id(2),id(12)]);
    assert.equal(navigations,1,'saving does not reload the page');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-gallery-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.main')).paddingLeft==='0px');
    await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
    await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-gallery-mobile.png'),fullPage:true});
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('main *')].map(element=>({tag:element.tagName,className:element.className,right:element.getBoundingClientRect().right,width:element.getBoundingClientRect().width})).filter(item=>item.right>window.innerWidth+1).slice(0,12));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`mobile gallery must not overflow horizontally: ${JSON.stringify(overflow)}`);
    await page.setViewportSize({width:1280,height:720});
    await page.getByRole('link',{name:'Xem chi tiết',exact:true}).click();
    await page.getByLabel('Xem ảnh 2',{exact:true}).waitFor();
    await page.getByLabel('Xem ảnh 2',{exact:true}).click();
    await page.getByRole('button',{name:'Xem ảnh gốc',exact:true}).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    assert.equal(context.pages().length,1,'full-size preview stays in the same tab');

    // Create first, then fail gallery save. Retry must not create another product
    // or discard/reupload files when the new product id appears in props.
    await page.goto(`${base}/data/products?new=1`);
    await page.getByLabel('Mã sản phẩm *',{exact:true}).fill('NEW');
    await page.getByLabel('SKU *',{exact:true}).fill('NEW-SKU');
    await page.getByLabel('Tên sản phẩm *',{exact:true}).fill('Sản phẩm mới');
    await page.getByLabel('Chọn nhiều ảnh sản phẩm').setInputFiles([{name:'new1.png',mimeType:'image/png',buffer:png},{name:'new2.png',mimeType:'image/png',buffer:png}]);
    failNext=true;
    await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Thông tin sản phẩm đã lưu'}).waitFor();
    assert.equal(creates,1); assert.equal(uploads,4);
    await page.getByRole('heading',{name:'Hình ảnh sản phẩm (2/20)',exact:true}).waitFor();
    await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
    assert.equal(creates,1); assert.equal(uploads,4); assert.equal(galleries.NEW.images.length,2);
    assert.ok(page.url().includes('edit=1')); assert.ok(!page.url().includes('new=1'));
    await page.getByLabel('Gỡ ảnh 2',{exact:true}).click();
    await page.getByLabel('Gỡ ảnh 1',{exact:true}).click();
    await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
    assert.deepEqual(galleries.NEW.images,[]); assert.equal(galleries.NEW.legacy_url,null);
    const previousPuts=puts;
    await page.getByLabel('Tên sản phẩm *',{exact:true}).fill('Đổi tên, không đổi ảnh');
    await page.getByRole('button',{name:'Lưu dữ liệu',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
    assert.equal(puts,previousPuts,'editing product fields must not overwrite gallery');
    assert.deepEqual(errors,[]);
    console.log('Product gallery browser passed: multi-upload, primary, reorder, remove, retry, create retry, inline updates and modal preview.');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

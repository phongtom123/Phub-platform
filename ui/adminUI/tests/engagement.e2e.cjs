// Browser API fixtures. No database, customer, survey or review mutations reach a live service.
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const adminBase=process.env.PHUB_ADMIN_TEST_URL||'http://localhost:3001',userBase=process.env.PHUB_USER_TEST_URL||'http://localhost:3000';
const QID='22222222-2222-4222-8222-222222222222',O1='33333333-3333-4333-8333-333333333333',O2='44444444-4444-4444-8444-444444444444';
const V1='55555555-5555-4555-8555-555555555555',V2='66666666-6666-4666-8666-666666666666',RID='77777777-7777-4777-8777-777777777777';
let survey=null,questions=[],completed=false,review=null,failDraft=true,failSubmit=true,failReview=true;
const writes={create:[],submit:[],review:[],moderate:[]},errors=[];
const detail=customer=>({survey,questions,recipient:customer?{ma_gui:RID,hoan_thanh_luc:completed?'2026-11-05T09:00:00Z':null}:null,answers:customer&&completed?[{ma_cau_hoi:QID,ma_lua_chon:O2,diem:null,noi_dung:'Lập trình và máy ảo'}]:[]});
const stats=()=>({survey,sent:1,completed:completed?1:0,text_page:1,page_size:20,questions:questions.map(q=>({...q,answered:completed?1:0,average:null,options:q.options.map(o=>({...o,count:completed&&o.ma_lua_chon===O2?1:0})),scores:[],texts:completed?['Lập trình và máy ảo']:[],text_total:completed?1:0}))});
const admin={ma_tk:'AD1',ten_tai_khoan:'admin.test',email:null,ma_nhan_vien:'NV1',ma_kh:null,trang_thai:1,role:'ADMIN',ho_ten:'Admin Test',ma_kho:null,owner_active:true,is_self:true};

async function mock(page,base,customer){
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname;
  if(url.origin!==new URL(base).origin)return route.abort();
  if(!p.startsWith('/api/'))return route.continue();
  const respond=(json,status=200)=>route.fulfill({status,json});
  if(p.endsWith('/auth/me'))return respond({account_id:customer?'TK1':'AD1',username:customer?'customer.test':'admin.test',role:customer?'KHACH_HANG':'ADMIN',name:customer?'Customer Test':'Admin Test',customer_id:customer?'KH1':null});
  if(p==='/api/backend/crm/surveys'&&request.method()==='POST'){
   const body=request.postDataJSON();writes.create.push(body);
   if(failDraft)return respond({detail:'Không lưu được bản nháp fixture.'},503);
   survey={ma_khao_sat:body.request_id,tieu_de:body.tieu_de,mo_ta:body.mo_ta,trang_thai:'NHAP',loai_doi_tuong:body.loai_doi_tuong,tuoi_tu:body.tuoi_tu,tuoi_den:body.tuoi_den,han_tra_loi:body.han_tra_loi,phien_ban:V1,ngay_tao:'2026-11-05T00:00:00Z',ngay_chot_doi_tuong:null};
   questions=body.questions.map(q=>({...q,ma_cau_hoi:QID,ma_khao_sat:survey.ma_khao_sat,thu_tu:1,options:q.options.map((o,i)=>({...o,ma_lua_chon:i===0?O1:O2,thu_tu:i+1}))}));return respond(detail(false));
  }
  if(p.endsWith('/publish')&&p.startsWith('/api/backend/crm/surveys/')){assert.equal(request.method(),'POST');assert.equal(request.postDataJSON().expected_version,V1);survey={...survey,trang_thai:'DANG_MO',phien_ban:V2,ngay_chot_doi_tuong:'2026-11-05T09:00:00Z'};return respond(detail(false));}
  if(p.endsWith('/submit')&&p.startsWith('/api/backend/customer/crm/surveys/')){
   assert.equal(request.method(),'POST');writes.submit.push(request.postDataJSON());
   if(failSubmit)return respond({detail:'Không gửi được khảo sát fixture.'},503);
   completed=true;return respond(detail(true));
  }
  if(p==='/api/backend/customer/crm/reviews'&&request.method()==='POST'){
   const body=request.postDataJSON();writes.review.push(body);if(failReview)return respond({detail:'Không lưu được đánh giá fixture.'},503);
   review={ma_danh_gia:RID,ma_kh:'KH1',ma_sp:body.product_id,ma_donhang:body.order_id,so_sao:body.stars,noi_dung:body.content,trang_thai:'HIEN_THI',phien_ban:V1,ngay_tao:'2026-11-05T09:00:00Z',cap_nhat_luc:'2026-11-05T09:00:00Z',ten_kh:'Customer Test',ten_sp:'Sản phẩm fixture'};return respond(review);
  }
  if(p.endsWith('/moderate')){assert.equal(request.method(),'POST');writes.moderate.push(request.postDataJSON());review={...review,trang_thai:request.postDataJSON().status,phien_ban:V2};return respond(review);}
  assert.equal(request.method(),'GET','Never forward an unknown mutation to a live service: '+p);
  if(p==='/api/backend/admin/me'||p==='/api/backend/admin/accounts/AD1')return respond(admin);
  if(p==='/api/backend/admin/accounts')return respond({data:[admin],total:1,page:1,page_size:20});
  if(p==='/api/backend/data/resources')return respond([]);
  if(p.startsWith('/api/backend/data/')||p.startsWith('/api/backend/admin/operations/'))return respond({data:[],total:0,page:1,page_size:20});
  if(p==='/api/backend/crm/surveys'||p==='/api/backend/customer/crm/surveys')return respond({data:survey?[{...survey,da_gui:1,da_tra_loi:completed?1:0,hoan_thanh_luc:completed?'2026-11-05T09:00:00Z':null}]:[],total:survey?1:0,page:1,page_size:20});
  if(p.endsWith('/preview'))return respond({data:[{ma_kh:'KH1',ten_kh:'Customer Test',tuoi:20}],total:1,page:1,page_size:20,phien_ban:survey.phien_ban,is_snapshot:survey.trang_thai!=='NHAP'});
  if(p.endsWith('/statistics'))return respond(stats());
  if(survey&&p===`/api/backend/crm/surveys/${survey.ma_khao_sat}`)return respond(detail(false));
  if(survey&&p===`/api/backend/customer/crm/surveys/${survey.ma_khao_sat}`)return respond(detail(true));
  if(p==='/api/backend/customer/crm/reviews/eligible')return respond({data:[{ma_donhang:'DH1',ma_sp:'SEED_SP001',ten_sp:'Sản phẩm fixture',sku:'SKU1',thoi_gian_dat:'2026-11-04T00:00:00Z',ma_danh_gia:review?.ma_danh_gia??null,so_sao:review?.so_sao??null,noi_dung:review?.noi_dung??null,trang_thai:review?.trang_thai??null,phien_ban:review?.phien_ban??null}],total:1,page:1,page_size:20});
  if(p==='/api/backend/crm/reviews')return respond({data:review&&(!url.searchParams.get('status')||url.searchParams.get('status')===review.trang_thai)?[review]:[],total:review&&(!url.searchParams.get('status')||url.searchParams.get('status')===review.trang_thai)?1:0,page:1,page_size:20});
  if(p==='/api/backend/crm/report')return respond({as_of:'2026-11-05',total_customers:2,age_groups:[{label:'18–24',count:1},{label:'Chưa có thông tin',count:1}],review_stars:[1,2,3,4,5].map(stars=>({stars,count:stars===5&&review?.trang_thai==='HIEN_THI'?1:0})),review_status:{pending:0,visible:review?.trang_thai==='HIEN_THI'?1:0,hidden:review?.trang_thai==='AN'?1:0},interest_surveys:survey?[{ma_khao_sat:survey.ma_khao_sat,tieu_de:survey.tieu_de}]:[]});
  if(p.includes('/catalog/products/')&&p.endsWith('/reviews'))return respond({data:review?.trang_thai==='HIEN_THI'?[{author:'Customer Test',so_sao:review.so_sao,noi_dung:review.noi_dung,ngay_tao:review.ngay_tao}]:[],total:review?.trang_thai==='HIEN_THI'?1:0,average:review?.trang_thai==='HIEN_THI'?review.so_sao:null,stars:[1,2,3,4,5].map(stars=>({stars,count:stars===5&&review?.trang_thai==='HIEN_THI'?1:0})),page:1,page_size:20});
  if(p.endsWith('/customer/me'))return respond({customer_id:'KH1',name:'Customer Test',phone:'0901234567',address_line:null,province:null,ward:null});
  if(p.startsWith('/api/catalog/'))return respond({items:[]});
  throw new Error('Unexpected API: '+p);
 });
}

(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE||undefined});
 try{
  const adminPage=await browser.newPage({viewport:{width:1440,height:1000}});await mock(adminPage,adminBase,false);
  await adminPage.goto(adminBase+'/surveys');await adminPage.getByRole('button',{name:'+ Tạo khảo sát',exact:true}).click();
  await adminPage.getByLabel('Tiêu đề khảo sát',{exact:true}).fill('Khảo sát nhu cầu laptop');
  await adminPage.getByLabel('Đối tượng khảo sát',{exact:true}).selectOption('DO_TUOI');
  await adminPage.getByLabel('Nội dung câu 1',{exact:true}).fill('Bạn dùng laptop để làm gì?');
  await adminPage.getByLabel('Đáp án 1 câu 1',{exact:true}).fill('Gaming');await adminPage.getByLabel('Đáp án 2 câu 1',{exact:true}).fill('Khác');
  await adminPage.getByLabel('Cho nhập Khác đáp án 2 câu 1',{exact:true}).check();
  await adminPage.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await adminPage.getByRole('alert').filter({hasText:'Không lưu được bản nháp fixture.'}).waitFor();
  assert.equal(await adminPage.getByLabel('Tiêu đề khảo sát',{exact:true}).inputValue(),'Khảo sát nhu cầu laptop');
  failDraft=false;await adminPage.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await adminPage.getByText('Đã lưu bản nháp. Xem trước đối tượng rồi phát hành khi sẵn sàng.',{exact:true}).waitFor();
  assert.equal(writes.create[0].request_id,writes.create[1].request_id);assert.equal(writes.create[1].tuoi_tu,18);assert.equal(writes.create[1].tuoi_den,24);
  await adminPage.getByRole('button',{name:'Xem trước khách nhận',exact:true}).click();await adminPage.getByRole('cell',{name:'Customer Test',exact:true}).waitFor();
  await adminPage.getByRole('button',{name:'Phát hành và gửi khảo sát',exact:true}).click();await adminPage.getByText('Đã phát hành khảo sát. Khách được chọn có thể xem trong Khảo sát của tôi.',{exact:true}).waitFor();
  assert.equal(await adminPage.getByLabel('Nội dung câu 1',{exact:true}).isDisabled(),true);
  const userPage=await browser.newPage({viewport:{width:1280,height:900}});await mock(userPage,userBase,true);
  await userPage.goto(userBase+'/main/surveys');await userPage.getByRole('button',{name:'Mở khảo sát',exact:true}).click();
  await userPage.getByLabel('Khác',{exact:true}).check();await userPage.getByRole('button',{name:'Gửi bài khảo sát',exact:true}).click();assert.equal(writes.submit.length,0,'Other text is mandatory');
  await userPage.getByLabel('Nội dung khác câu 1',{exact:true}).fill('Lập trình và máy ảo');
  await userPage.getByRole('button',{name:'Gửi bài khảo sát',exact:true}).click();await userPage.getByRole('alert').filter({hasText:'Không gửi được khảo sát fixture.'}).waitFor();
  assert.equal(await userPage.getByLabel('Nội dung khác câu 1',{exact:true}).inputValue(),'Lập trình và máy ảo');
  failSubmit=false;await userPage.getByRole('button',{name:'Gửi bài khảo sát',exact:true}).click();await userPage.getByText('Đã gửi khảo sát. Cảm ơn bạn đã chia sẻ!',{exact:true}).waitFor();
  assert.equal(writes.submit[0].submission_id,writes.submit[1].submission_id);assert.equal(await userPage.getByLabel('Nội dung khác câu 1',{exact:true}).isDisabled(),true);
  await adminPage.getByRole('button',{name:'Làm mới kết quả',exact:true}).click();await adminPage.getByText('Lập trình và máy ảo',{exact:true}).waitFor();
  await userPage.goto(userBase+'/main/reviews');await userPage.getByRole('button',{name:'Viết đánh giá',exact:true}).click();await userPage.getByLabel('Nội dung đánh giá',{exact:true}).fill('Sản phẩm tốt, phù hợp nhu cầu.');
  await userPage.getByRole('button',{name:'Gửi đánh giá',exact:true}).click();await userPage.getByRole('alert').filter({hasText:'Không lưu được đánh giá fixture.'}).waitFor();
  failReview=false;await userPage.getByRole('button',{name:'Gửi đánh giá',exact:true}).click();await userPage.getByText('Đã lưu đánh giá: Đang hiển thị.',{exact:true}).waitFor();
  await adminPage.goto(adminBase+'/reviews');await adminPage.getByRole('button',{name:'Ẩn đánh giá',exact:true}).click();await adminPage.getByText('Đã ẩn đánh giá.',{exact:true}).waitFor();assert.equal(writes.moderate[0].expected_version,V1);
  await adminPage.getByRole('button',{name:'Hiển thị lại',exact:true}).click();await adminPage.getByText('Đã hiển thị lại đánh giá.',{exact:true}).waitFor();
  await adminPage.goto(adminBase+'/crm-report');await adminPage.getByRole('heading',{name:'Phân bố độ tuổi',exact:true}).waitFor();await adminPage.getByText('Chưa có thông tin',{exact:true}).waitFor();
  await adminPage.setViewportSize({width:390,height:844});await adminPage.waitForTimeout(200);assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await adminPage.screenshot({path:path.join(os.tmpdir(),'phub-crm-report-mobile.png'),fullPage:true});
  await userPage.setViewportSize({width:390,height:844});assert.ok(await userPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await userPage.screenshot({path:path.join(os.tmpdir(),'phub-customer-reviews-mobile.png'),fullPage:true});
  // Product SSR uses the existing read-only catalog; every browser review API is mocked above.
  const catalogResponse=await fetch(userBase+'/api/catalog/products?page=1&page_size=1&include_inactive=true');
  const catalog=await catalogResponse.json();const publicProduct=process.env.PHUB_PUBLIC_TEST_PRODUCT_ID||catalog.items?.[0]?.id;
  assert.ok(publicProduct,'Read-only catalog must supply a visible product for SSR verification');
  await userPage.goto(userBase+'/main/product/'+encodeURIComponent(publicProduct));await userPage.getByRole('region',{name:'Đánh giá sản phẩm',exact:true}).getByText('Sản phẩm tốt, phù hợp nhu cầu.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: admin draft/error/age preview/publish, customer Other/submit retry, statistics, verified-review UI/moderation, public review display and mobile layouts. Browser API fixtures; no live writes.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

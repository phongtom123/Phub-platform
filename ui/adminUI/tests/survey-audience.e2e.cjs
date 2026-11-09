/** Browser fixtures only. Every API request is intercepted; no real survey is created. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_STAFF_TEST_URL||'http://localhost:3002';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],saves=[],previews=[];
 const customers=[{ma_kh:'KH_A',ten_kh:'Young customer',tuoi:21},{ma_kh:'KH_B',ten_kh:'Older customer',tuoi:45},{ma_kh:'KH_C',ten_kh:'No birthday',tuoi:null}];
 let stored=null;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(base).origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
  const respond=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname.endsWith('/auth/me'))return respond({account_id:'STAFF',username:'staff',role:'NHAN_VIEN',name:'Staff',employee_id:'NV1',warehouse_id:1});
  if(url.pathname.endsWith('/data/resources'))return respond([]);
  if(url.pathname==='/api/backend/crm/survey-audience'){
   const config=req.postDataJSON();previews.push(config);
   const matches=c=>config.loai_doi_tuong==='TAT_CA'||config.loai_doi_tuong==='CHUA_NGAY_SINH'&&c.tuoi===null||config.loai_doi_tuong==='DO_TUOI'&&c.tuoi!==null&&c.tuoi>=config.tuoi_tu&&c.tuoi<=config.tuoi_den;
   const chosen=c=>!config.khach_loai.includes(c.ma_kh)&&(config.khach_them.includes(c.ma_kh)||matches(c));
   const q=(url.searchParams.get('q')||'').toLowerCase(),selected=url.searchParams.get('scope')!=='candidates';
   const data=customers.filter(c=>chosen(c)===selected&&[c.ma_kh,c.ten_kh].join(' ').toLowerCase().includes(q)).map(c=>({...c,added_manually:config.khach_them.includes(c.ma_kh)&&!matches(c)}));
   return respond({data,total:data.length,selected_total:customers.filter(chosen).length,page:1,page_size:20,unavailable_added_ids:[]});
  }
  if(url.pathname==='/api/backend/crm/surveys'&&req.method()==='GET')return respond({data:stored?[{...stored.survey,da_gui:0,da_tra_loi:0}]:[],total:stored?1:0,page:1,page_size:20});
  if(url.pathname==='/api/backend/crm/surveys'&&req.method()==='POST'){
   const body=req.postDataJSON();saves.push(body);
   stored={survey:{...body,ma_khao_sat:body.request_id,trang_thai:'NHAP',phien_ban:'11111111-1111-4111-8111-111111111111',ngay_tao:'2026-11-09T00:00:00Z'},questions:body.questions.map((q,i)=>({...q,ma_cau_hoi:`22222222-2222-4222-8222-${String(i+1).padStart(12,'0')}`,options:q.options.map((o,n)=>({...o,ma_lua_chon:`33333333-3333-4333-8333-${String(n+1).padStart(12,'0')}`,thu_tu:n+1}))})),answers:[],recipient:null};
   return respond(stored);
  }
  if(stored&&url.pathname===`/api/backend/crm/surveys/${stored.survey.ma_khao_sat}`)return respond(stored);
  return respond({data:[],total:0,page:1,page_size:20});
 });
 await page.goto(base+'/surveys');await page.getByRole('button',{name:'+ Tạo khảo sát',exact:true}).click();
 const audience=page.getByRole('region',{name:'Chọn người nhận khảo sát'});
 await audience.getByRole('button',{name:'Bỏ người nhận KH_A',exact:true}).waitFor();
 assert.ok(await audience.getByRole('button',{name:'Bỏ người nhận KH_B',exact:true}).isVisible(),'Default audience loads before saving title/questions');
 await page.getByRole('combobox',{name:'Đối tượng khảo sát',exact:true}).selectOption('DO_TUOI');
 await audience.getByRole('button',{name:'Bỏ người nhận KH_A',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Bỏ người nhận KH_B"]')===null);
 await audience.getByRole('button',{name:'Bỏ người nhận KH_A',exact:true}).click();
 await audience.getByText('Chưa có người nhận. Bạn có thể thêm khách bên dưới.',{exact:true}).waitFor();
 await audience.locator('summary').click();await audience.getByRole('button',{name:'Thêm người nhận KH_B',exact:true}).click();
 await audience.getByRole('button',{name:'Bỏ người nhận KH_B',exact:true}).waitFor();
 assert.ok(await audience.getByText('Thêm thủ công ngoài bộ lọc',{exact:true}).isVisible());
 await audience.getByRole('button',{name:'Thêm người nhận KH_A',exact:true}).click();
 await audience.getByRole('button',{name:'Bỏ người nhận KH_A',exact:true}).waitFor();
 await audience.getByRole('textbox',{name:'Tìm người nhận khảo sát'}).fill('Older');await audience.getByRole('textbox',{name:'Tìm người nhận khảo sát'}).press('Enter');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Bỏ người nhận KH_A"]')===null);assert.equal(saves.length,0,'Picker search does not submit parent draft form');
 await audience.getByRole('textbox',{name:'Tìm người nhận khảo sát'}).fill('');await audience.getByRole('button',{name:'Bỏ người nhận KH_A',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Tiêu đề khảo sát',exact:true}).fill('Audience test');await page.getByRole('textbox',{name:'Nội dung câu 1',exact:true}).fill('Purpose?');
 await page.getByRole('textbox',{name:'Đáp án 1 câu 1',exact:true}).fill('Gaming');await page.getByRole('textbox',{name:'Đáp án 2 câu 1',exact:true}).fill('Other');
 await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await page.getByText('Đã lưu bản nháp. Xem trước đối tượng rồi phát hành khi sẵn sàng.',{exact:true}).waitFor();
 assert.deepEqual(saves[0].khach_them,['KH_A','KH_B']);assert.deepEqual(saves[0].khach_loai,[]);
 await page.getByRole('button',{name:'← Danh sách khảo sát',exact:true}).click();await page.getByRole('button',{name:'Mở khảo sát',exact:true}).click();
 await audience.getByRole('button',{name:'Bỏ người nhận KH_B',exact:true}).waitFor();assert.ok(await audience.getByRole('button',{name:'Bỏ người nhận KH_A',exact:true}).isVisible(),'Reopening draft restores manual selection');
 assert.ok(previews.some(config=>config.khach_loai.includes('KH_A')));assert.deepEqual(errors,[]);
 console.log('Survey audience browser: automatic list, age filter, remove/add, manual override, search without save, persistence and reopen passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

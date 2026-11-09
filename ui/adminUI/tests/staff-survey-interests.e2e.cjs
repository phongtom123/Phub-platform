/** Mock all API requests: no live survey answers or customer records are modified. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_STAFF_TEST_URL||'http://localhost:3002';
const SID='11111111-1111-4111-8111-111111111111', QID='22222222-2222-4222-8222-222222222222';
const SECOND='33333333-3333-4333-8333-333333333333';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}), errors=[], calls=[], writes=[];
 const survey={ma_khao_sat:SID,tieu_de:'Nhu cầu sử dụng máy tính',mo_ta:'Khảo sát đã phát hành',trang_thai:'DANG_MO',loai_doi_tuong:'TAT_CA',tuoi_tu:null,tuoi_den:null,han_tra_loi:'2099-01-01T00:00:00Z',phien_ban:'44444444-4444-4444-8444-444444444444',ngay_tao:'2026-11-01T00:00:00Z'};
 const question={ma_cau_hoi:QID,noi_dung:'Bạn dùng máy tính cho việc gì?',loai_cau_hoi:'MOT_LUA_CHON',nhom_noi_dung:'SO_THICH',bat_buoc:true,options:[{ma_lua_chon:SECOND,noi_dung:'Khác',cho_phep_nhap_khac:true,thu_tu:1}]};
 const answer={ma_tra_loi:SECOND,ma_kh:'KH_FIXTURE',ten_kh:'Khách thử nghiệm',tuoi:24,ma_khao_sat:SID,tieu_de:survey.tieu_de,ma_cau_hoi:QID,cau_hoi:question.noi_dung,loai_cau_hoi:'MOT_LUA_CHON',lua_chon:'Khác',noi_dung:'Thiết kế đồ họa và AI',diem:null,hoan_thanh_luc:'2026-11-09T01:00:00Z'};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  calls.push(url);
  if(req.method()!=='GET'){writes.push(url.pathname);return route.fulfill({status:500,body:'Unexpected mutation'});}
  const respond=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname.endsWith('/auth/me'))return respond({account_id:'STAFF_FIXTURE',username:'staff',role:'NHAN_VIEN',name:'Nhân viên',employee_id:'NV2',warehouse_id:1});
  if(url.pathname.endsWith('/data/resources'))return respond([]);
  if(url.pathname==='/api/backend/crm/surveys')return respond({data:[{...survey,da_gui:2,da_tra_loi:1}],total:1,page:1,page_size:20});
  if(url.pathname===`/api/backend/crm/surveys/${SID}`)return respond({survey,questions:[question],answers:[],recipient:null});
  if(url.pathname.endsWith('/statistics'))return respond({survey,sent:2,completed:1,text_page:1,page_size:20,questions:[{...question,answered:1,average:null,options:[{ma_lua_chon:SECOND,noi_dung:'Khác',count:1}],scores:[],texts:[answer.noi_dung],text_total:1}]});
  if(url.pathname.endsWith('/results'))return respond({
   statistics:{survey,sent:2,completed:1,text_page:1,page_size:20,questions:[{...question,answered:1,average:null,options:[{ma_lua_chon:SECOND,noi_dung:'Khác',count:1}],scores:[],texts:[answer.noi_dung],text_total:1}]},
   creator:{ma_tk:'STAFF_FIXTURE',ho_ten:'Nhân viên tạo khảo sát'},
   respondents:{data:[{ma_gui:SECOND,ma_kh:answer.ma_kh,ten_kh:answer.ten_kh,tuoi:24,luu_tru_luc:null,hoan_thanh_luc:answer.hoan_thanh_luc,answers:[{ma_cau_hoi:QID,cau_hoi:question.noi_dung,nhom_noi_dung:'SO_THICH',lua_chon:'Khác',noi_dung:answer.noi_dung,diem:null}]}],total:1,page:1,page_size:20}
  });
  if(url.pathname==='/api/backend/crm/interests'){
   const empty=Boolean(url.searchParams.get('q'))||url.searchParams.get('survey_id')===SECOND;
   return respond({data:empty?[]:[answer],total:empty?0:1,page:1,page_size:20,customers:empty?0:1,survey_count:empty?0:1,question_count:empty?0:1,
    summaries:empty?[]:[{ma_khao_sat:SID,tieu_de:survey.tieu_de,ma_cau_hoi:QID,cau_hoi:question.noi_dung,loai_cau_hoi:'MOT_LUA_CHON',answered:1,options:[{label:'Khác',count:1}]}],
    surveys:[{ma_khao_sat:SID,tieu_de:survey.tieu_de},{ma_khao_sat:SECOND,tieu_de:'Khảo sát chưa có phản hồi'}]});
  }
  return respond({data:[],total:0,page:1,page_size:20});
 });
 await page.goto(base+'/surveys');
 await page.getByRole('link',{name:'Xem kết quả',exact:true}).click();
 await page.waitForURL('**/surveys/'+SID+'/results');
 await page.getByRole('heading',{name:'Danh sách người trả lời'}).waitFor();
 assert.equal(await page.locator('fieldset').count(),0,'Results never render authoring fields');
 assert.ok(await page.getByRole('cell',{name:'24 tuổi',exact:true}).isVisible());
 assert.ok(await page.getByText('Nhân viên tạo khảo sát',{exact:true}).isVisible());
 await page.locator('summary').filter({hasText:'Xem câu trả lời (1)'}).click();
 await page.locator('details').getByText(answer.noi_dung,{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Thống kê câu hỏi',exact:true}).click();
 const results=page.getByRole('region',{name:'Thống kê khảo sát'});
 await results.getByText(answer.noi_dung,{exact:true}).waitFor();
 assert.ok(await page.getByText('50%',{exact:true}).isVisible());
 await page.getByRole('link',{name:'← Danh sách khảo sát',exact:true}).click();
 await page.getByRole('button',{name:'Sở thích khách hàng',exact:true}).click();
 await page.getByRole('heading',{name:'Sở thích khách hàng',exact:true}).waitFor();
 await page.getByRole('cell',{name:/Thiết kế đồ họa và AI/}).waitFor();
 assert.ok(await page.getByRole('link',{name:'Khách thử nghiệm',exact:true}).isVisible());
 await page.getByRole('textbox',{name:'Tìm sở thích',exact:true}).fill('Không khớp');
 await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
 await page.getByRole('heading',{name:'Chưa có phản hồi sở thích phù hợp'}).waitFor();
 assert.equal(await page.getByRole('cell',{name:/Thiết kế đồ họa và AI/}).count(),0);
 await page.getByRole('textbox',{name:'Tìm sở thích',exact:true}).fill('');
 await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
 await page.getByRole('cell',{name:/Thiết kế đồ họa và AI/}).waitFor();
 await page.getByRole('combobox',{name:'Lọc khảo sát sở thích'}).selectOption(SECOND);
 await page.getByRole('heading',{name:'Chưa có phản hồi sở thích phù hợp'}).waitFor();
 await page.getByRole('combobox',{name:'Lọc khảo sát sở thích'}).selectOption('');
 await page.getByRole('link',{name:'Xem kết quả khảo sát →',exact:true}).click();
 await page.getByRole('tab',{name:'Thống kê câu hỏi',exact:true}).click();
 await page.getByRole('region',{name:'Thống kê khảo sát'}).getByText(answer.noi_dung,{exact:true}).waitFor();
 assert.ok(calls.some(url=>url.pathname==='/api/backend/crm/interests'&&url.searchParams.get('q')==='Không khớp'));
 for(const query of [`?id=${SID}&view=results`,`?id=${SID}`]){
  await page.goto(base+'/surveys'+query);
  await page.waitForURL('**/surveys/'+SID+'/results');
  await page.getByRole('heading',{name:'Danh sách người trả lời',exact:true}).waitFor();
  assert.equal(await page.locator('fieldset').count(),0,'Legacy result URLs never show the authoring form');
 }
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 console.log('Staff survey results/interests browser: result access, navigation, provenance, Other text, search and filters passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

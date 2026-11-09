/** Targeted PostgreSQL fixtures: completed survey answers and internal read permissions only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE||'@electric-sql/pglite');
const sql=name=>fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8');
(async()=>{const db=await PGlite.create();try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
  const names = [
   '001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
   '20261022_crm_customer_profile_interests.sql', '20261022_crm_admin_profile_api.sql',
   '20261023012955_remove_customer_interests.sql', '20261023_customer_support.sql',
   '20261024161801_account_plaintext_passwords.sql', '20261028132157_admin_operations.sql',
   '20261028154622_disable_transfers_single_warehouse.sql', '20261029162141_warehouse_receipts.sql',
   '20261030023519_receipt_sale_pricing.sql', '20261030034222_fixed_operating_warehouse.sql',
   '20261030151651_simplify_receipt_pricing.sql', '20261101162759_unlock_warehouses.sql',
   '20261104100000_admin_order_history.sql', '20261105083031_customer_soft_delete.sql',
   '20261105093025_crm_surveys_reviews.sql', '20261106083600_counter_invoice_claims.sql',
   '20261106142849_staff_operational_workspace.sql',
   '20261109072011_staff_survey_results_interests.sql',
   '20261109073654_survey_results_respondents.sql',
  ];
 for(const name of names){
  await db.exec(sql(name));
  if(name==='001_initial_schema.sql')await db.exec(`insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(2,'Store 2','Address');`);
 }
 await db.exec(`insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(1,'Store 1','Address');
  insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('NV1','ADMIN','Admin',null),('NV2','NHAN_VIEN','Staff',1);
  insert into public."KHACH_HANG"(ma_kh,ten_kh) values('KH1','Customer');
  insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_nhan_vien) values('AD1','admin','fixture-only-password','NV1'),('STAFF','staff','fixture-only-password','NV2');
  insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_kh) values('CUSTOMER','customer','fixture-only-password','KH1');
  set role service_role;`);
 const rpc=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 const forbidden=promise=>assert.rejects(promise,e=>e.code==='42501'||e.message==='ADMIN_FORBIDDEN');
 await forbidden(rpc('public.crm_survey_read_v1',['STAFF',true,'report',null,1]));
  const surveyId=randomUUID();
  const draftSurvey={tieu_de:'Interests fixture',mo_ta:'',loai_doi_tuong:'TAT_CA',tuoi_tu:null,tuoi_den:null,han_tra_loi:'2099-01-01T00:00:00Z',questions:[
   {noi_dung:'Purpose?',loai_cau_hoi:'MOT_LUA_CHON',nhom_noi_dung:'SO_THICH',bat_buoc:true,options:[{noi_dung:'Gaming'},{noi_dung:'Other',cho_phep_nhap_khac:true}]},
   {noi_dung:'Need?',loai_cau_hoi:'VAN_BAN',nhom_noi_dung:'SO_THICH',bat_buoc:true,options:[]},
   {noi_dung:'Happy?',loai_cau_hoi:'DIEM_1_5',nhom_noi_dung:'HAI_LONG',bat_buoc:true,options:[]},
   {noi_dung:'General?',loai_cau_hoi:'VAN_BAN',nhom_noi_dung:'CHUNG',bat_buoc:true,options:[]},
  ]};
  const createdSurvey=await rpc('public.crm_survey_write_v1',['STAFF',surveyId,'create',JSON.stringify(draftSurvey),null]);
  await rpc('public.crm_survey_write_v1',['STAFF',surveyId,'publish','{}',createdSurvey.survey.phien_ban]);
  const [choiceQuestion,textQuestion,scoreQuestion,generalQuestion]=createdSurvey.questions;
  await rpc('public.crm_survey_submit_v1',['CUSTOMER',surveyId,randomUUID(),JSON.stringify([
   {ma_cau_hoi:choiceQuestion.ma_cau_hoi,ma_lua_chon:choiceQuestion.options.find(o=>o.cho_phep_nhap_khac).ma_lua_chon,noi_dung:'AI and design'},
   {ma_cau_hoi:textQuestion.ma_cau_hoi,noi_dung:'Laptop for study'},
   {ma_cau_hoi:scoreQuestion.ma_cau_hoi,diem:5},
   {ma_cau_hoi:generalQuestion.ma_cau_hoi,noi_dung:'Do not classify this as an interest'},
  ])]);
  const stats=await rpc('public.crm_survey_read_v1',['STAFF',true,'statistics',surveyId,1]);
  assert.equal(stats.completed,1,'Staff can read per-survey results');
  const interests=()=>rpc('public.crm_customer_interests_v1',['STAFF',null,'',1]);
  const first=await interests();
  assert.equal(first.total,2);assert.equal(first.customers,1);assert.equal(first.question_count,2);
  assert.equal(first.data.find(a=>a.lua_chon==='Other').noi_dung,'AI and design');
  assert.equal(first.summaries.find(s=>s.ma_cau_hoi===choiceQuestion.ma_cau_hoi).options[0].count,1);
  assert.equal((await rpc('public.crm_customer_interests_v1',['AD1',surveyId,'',1])).total,2);
  await db.exec(`update public."KHACH_HANG" set ngay_sinh='2000-01-01' where ma_kh='KH1';`);
  const readResults=(actor='STAFF',q='',page=1)=>rpc('public.crm_survey_results_v1',[actor,surveyId,q,page,1]);
  const results=await readResults();
  assert.equal(results.creator.ho_ten,'Staff');assert.equal(results.respondents.total,1);
  assert.equal(results.respondents.data[0].ten_kh,'Customer');
  assert.equal(results.respondents.data[0].tuoi,new Date().getUTCFullYear()-2000);
  assert.equal(results.respondents.data[0].answers.length,4);
  assert.equal(results.respondents.data[0].answers.find(a=>a.lua_chon==='Other').noi_dung,'AI and design');
  assert.equal(results.respondents.data[0].answers.find(a=>a.nhom_noi_dung==='HAI_LONG').diem,5);
  assert.equal((await readResults('AD1')).respondents.total,1);
  await forbidden(readResults('CUSTOMER'));
  await assert.rejects(rpc('public.crm_survey_results_v1',['STAFF',randomUUID(),'',1,1]),e=>e.code==='P0002');
  const filtered=await rpc('public.crm_customer_interests_v1',['STAFF',surveyId,'  STUDY  ',1]);
  assert.equal(filtered.total,1);assert.equal(filtered.summaries.length,1);assert.equal(filtered.data[0].ma_cau_hoi,textQuestion.ma_cau_hoi);
  assert.equal((await rpc('public.crm_customer_interests_v1',['STAFF',null,'%',1])).total,0,'Search is literal');
  await forbidden(rpc('public.crm_customer_interests_v1',['CUSTOMER',null,'',1]));
  await assert.rejects(rpc('public.crm_customer_interests_v1',['STAFF',null,'',0]),e=>e.code==='23514');
  await assert.rejects(rpc('public.crm_customer_interests_v1',['STAFF',randomUUID(),'',1]),e=>e.code==='P0002');
  await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh) select 'PAGE'||i,'Pagination customer '||i from generate_series(1,21) i;
   insert into public."GUI_KHAO_SAT"(ma_khao_sat,ma_kh,hoan_thanh_luc,khoa_gui_bai,hash_gui_bai)
    select '${surveyId}',ma_kh,'2026-11-01T10:00:00Z',gen_random_uuid(),'fixture' from public."KHACH_HANG" where ma_kh like 'PAGE%';
   insert into public."TRA_LOI_KHAO_SAT"(ma_gui,ma_khao_sat,ma_cau_hoi,noi_dung)
    select ma_gui,ma_khao_sat,'${textQuestion.ma_cau_hoi}','Pagination answer' from public."GUI_KHAO_SAT" where ma_kh like 'PAGE%';`);
  const pageOne=await interests(),pageTwo=await rpc('public.crm_customer_interests_v1',['STAFF',null,'',2]);
  assert.equal(pageOne.total,23);assert.equal(pageTwo.total,23);
  assert.equal(pageOne.customers,22);assert.equal(pageOne.data.length,20);assert.equal(pageTwo.data.length,3);
  assert.equal(new Set([...pageOne.data,...pageTwo.data].map(a=>a.ma_tra_loi)).size,23,'No duplicates across tied timestamps');
  const respondentsOne=await readResults(),respondentsTwo=await readResults('STAFF','',2);
  assert.equal(respondentsOne.respondents.total,22);assert.equal(respondentsOne.respondents.data.length,20);assert.equal(respondentsTwo.respondents.data.length,2);
  assert.equal(new Set([...respondentsOne.respondents.data,...respondentsTwo.respondents.data].map(p=>p.ma_gui)).size,22);
  assert.ok(respondentsOne.respondents.data.some(p=>p.tuoi===null),'Missing birthdays are explicit null');
  const searched=await readResults('STAFF','CUSTOMER 21');
  assert.equal(searched.respondents.total,1);assert.equal(searched.respondents.data[0].ma_kh,'PAGE21');
  assert.equal(searched.statistics.completed,22,'Respondent search does not change aggregate totals');
  assert.equal((await readResults('STAFF','%')).respondents.total,0,'Respondent search is literal');
  await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh) values('PENDING','Incomplete customer');
    insert into public."GUI_KHAO_SAT"(ma_khao_sat,ma_kh) values('${surveyId}','PENDING');
    insert into public."TRA_LOI_KHAO_SAT"(ma_gui,ma_khao_sat,ma_cau_hoi,noi_dung)
      select ma_gui,ma_khao_sat,'${textQuestion.ma_cau_hoi}','Not submitted' from public."GUI_KHAO_SAT" where ma_kh='PENDING';`);
  assert.equal((await interests()).total,23,'Incomplete submissions never contribute');
  assert.equal((await readResults()).respondents.total,22,'Only completed respondents are listed');
  await rpc('public.admin_archive_customer_v1',['KH1','STAFF',true]);
  assert.equal((await interests()).total,21,'Archived customer profiles are excluded');
  const archivedHistory=(await readResults()).respondents.data.find(p=>p.ma_kh==='KH1');
  assert.ok(archivedHistory.luu_tru_luc,'Result history keeps archived respondents and marks them');
  for(const role of ['anon','authenticated']) assert.equal((await db.query('select has_function_privilege($1,$2,$3) permitted',[role,'public.crm_survey_results_v1(text,uuid,text,integer,integer)','EXECUTE'])).rows[0].permitted,false);
  for(const role of ['anon','authenticated']) assert.equal((await db.query('select has_function_privilege($1,$2,$3) permitted',[role,'public.crm_customer_interests_v1(text,uuid,text,integer)','EXECUTE'])).rows[0].permitted,false);
  console.log('Staff survey results/interests SQL: permissions, provenance, Other text, filtering, pagination and completed-only answers passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

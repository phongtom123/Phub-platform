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
   '20261109081917_survey_custom_audience.sql',
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

 await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh,ngay_sinh) values
  ('KH_A','Young customer',((statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-interval '21 years')::date),
  ('KH_B','Older customer',((statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-interval '45 years')::date),
  ('KH_C','No birthday',null),('KH_D','Inactive',null);
  insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_kh,trang_thai) values
  ('ACT_A','customer_a','fixture-only-password','KH_A',1),('ACT_B','customer_b','fixture-only-password','KH_B',1),
  ('ACT_C','customer_c','fixture-only-password','KH_C',1),('ACT_D','customer_d','fixture-only-password','KH_D',0);`);
 const target={loai_doi_tuong:'DO_TUOI',tuoi_tu:20,tuoi_den:24,khach_them:[],khach_loai:[]};
 const preview=(config,scope='selected',query='',actor='STAFF')=>rpc('public.crm_survey_audience_preview_v1',[actor,JSON.stringify(config),scope,query,1]);
 assert.deepEqual((await preview(target)).data.map(p=>p.ma_kh),['KH_A']);
 const custom={...target,khach_them:['KH_C','KH_B'],khach_loai:['KH_A']};
 const chosen=await preview(custom);assert.equal(chosen.selected_total,2);assert.equal(chosen.total,2);assert.ok(chosen.data.every(p=>p.added_manually));
 assert.equal(chosen.data.find(p=>p.ma_kh==='KH_C').tuoi,null,'No birthday customers can be explicitly added');
 const candidates=await preview(custom,'candidates');assert.ok(candidates.data.some(p=>p.ma_kh==='KH_A'));assert.ok(!candidates.data.some(p=>p.ma_kh==='KH_D'));
 const searched=await preview(custom,'selected','OLDER');assert.equal(searched.total,1);assert.equal(searched.selected_total,2,'Search does not change recipient count');
 assert.equal((await preview(custom,'selected','%')).total,0,'Literal search');
 for(const actor of ['AD1','CUSTOMER'])await forbidden(preview(custom,'selected','',actor));
 await assert.rejects(preview({...custom,khach_loai:['KH_B']}),e=>e.code==='23514');
 await assert.rejects(preview({...custom,khach_them:['KH_B','KH_B']}),e=>e.code==='23514');
 const unavailable=await preview({...target,khach_them:['KH_D']});assert.deepEqual(unavailable.unavailable_added_ids,['KH_D']);
 const body={...custom,tieu_de:'Manual audience',mo_ta:'',han_tra_loi:'2099-01-01T00:00:00Z',questions:[{noi_dung:'Purpose?',loai_cau_hoi:'VAN_BAN',nhom_noi_dung:'SO_THICH',bat_buoc:true,options:[]}]};
 const id=randomUUID();
 const created=await rpc('public.crm_survey_write_v1',['STAFF',id,'create',JSON.stringify(body),null]);
 assert.deepEqual(created.survey.khach_them,['KH_B','KH_C']);assert.deepEqual(created.survey.khach_loai,['KH_A']);
 const version=created.survey.phien_ban;
 assert.equal((await rpc('public.crm_survey_write_v1',['STAFF',id,'create',JSON.stringify(body),null])).survey.phien_ban,version,'Create retry does not duplicate selection');
 const legacy={...body};delete legacy.khach_them;delete legacy.khach_loai;
 const updated=await rpc('public.crm_survey_write_v1',['STAFF',id,'update',JSON.stringify(legacy),version]);
 assert.deepEqual(updated.survey.khach_them,['KH_B','KH_C'],'Older update clients cannot clear saved overrides');
 assert.equal((await rpc('public.crm_survey_read_v1',['STAFF',true,'preview',id,1])).total,2);
 await db.exec(`update public."TAI_KHOAN" set trang_thai=2 where ma_tk='ACT_B';`);
 assert.deepEqual((await preview(custom)).unavailable_added_ids,['KH_B']);
 await assert.rejects(rpc('public.crm_survey_write_v1',['STAFF',id,'publish','{}',updated.survey.phien_ban]),e=>e.code==='23514');
 assert.equal((await db.query('select trang_thai from public."KHAO_SAT" where ma_khao_sat=$1',[id])).rows[0].trang_thai,'NHAP','Failed publication rolls back recipients/state');
 await db.exec(`update public."TAI_KHOAN" set trang_thai=1 where ma_tk='ACT_B';`);
 const published=await rpc('public.crm_survey_write_v1',['STAFF',id,'publish','{}',updated.survey.phien_ban]);
 const recipients=(await db.query('select ma_kh from public."GUI_KHAO_SAT" where ma_khao_sat=$1 order by ma_kh',[id])).rows.map(p=>p.ma_kh);
 assert.deepEqual(recipients,['KH_B','KH_C'],'Publish respects both manual adds and removals');
 await rpc('public.crm_survey_write_v1',['STAFF',id,'publish','{}',updated.survey.phien_ban]);
 assert.equal((await db.query('select count(*)::int n from public."GUI_KHAO_SAT" where ma_khao_sat=$1',[id])).rows[0].n,2);
 const own=await rpc('public.crm_survey_detail_v1',[id,'ACT_B',false]);
 assert.ok(!('khach_them' in own.survey)&&!('khach_loai' in own.survey),'Customer cannot see other recipients IDs');
 await assert.rejects(rpc('public.crm_survey_write_v1',['STAFF',id,'update',JSON.stringify({...body,khach_them:[]}),published.survey.phien_ban]),e=>e.code==='23514');
 await db.exec(`update public."TAI_KHOAN" set trang_thai=0 where ma_tk='ACT_B';`);
 assert.equal((await rpc('public.crm_survey_read_v1',['STAFF',true,'preview',id,1])).total,2,'Published recipient snapshot stays fixed');
 for(const role of ['anon','authenticated'])assert.equal((await db.query('select has_function_privilege($1,$2,$3) ok',[role,'public.crm_survey_audience_preview_v1(text,jsonb,text,text,integer)','EXECUTE'])).rows[0].ok,false);
 console.log('Survey custom audience SQL: live preview, manual add/remove, active checks, persistence, legacy updates, publish/retry, fixed snapshot and customer privacy passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

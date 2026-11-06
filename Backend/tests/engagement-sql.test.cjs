// Isolated PostgreSQL fixtures only. No .env, network or production data.
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const db=await PGlite.create();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
  await db.exec(fs.readFileSync(path.join(root,'Backend/migrations/001_initial_schema.sql'),'utf8'));
  await db.exec(`alter table public."KHACH_HANG" add column ngay_sinh date,add column luu_tru_luc timestamptz;
    insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('NV1','ADMIN','Admin');
    insert into public."KHACH_HANG"(ma_kh,ten_kh,ngay_sinh,luu_tru_luc) values
      ('KH1','Customer 1',(current_date-interval '20 years')::date,null),('KH2','Customer 2',(current_date-interval '40 years')::date,null),
      ('KH3','No birthday',null,null),('KH4','Archived',(current_date-interval '20 years')::date,now()),('KH5','Inactive',(current_date-interval '20 years')::date,null);
    insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('AD1','admin','fixture','NV1');
    insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh,trang_thai) values
      ('TK1','c1','fixture','KH1',1),('TK2','c2','fixture','KH2',1),('TK3','c3','fixture','KH3',1),('TK4','c4','fixture','KH4',1),('TK5','c5','fixture','KH5',2);
    insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(1,'Warehouse','Address');
    insert into public."LOAI_SP"(ma_loai_sp,ten_loai_sp) values('L1','Category');
    insert into public."LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('L2','Child','L1');
    insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai) values('SP1','SKU1','Product 1','L1','L2',100),('SP2','SKU2','Product 2','L1','L2',200);
    insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values('DH1','KH1','ONLINE','HOAN_THANH',now()),('DH2','KH1','ONLINE','MOI',now());
    insert into public."CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,thue_suat,tien_thue,thanh_tien)
      values('DH1','SKU1',1,'Product 1','Cai',1,100,0,0,100),('DH1','SKU1',1,'Product 1','Cai',2,100,0,0,200),('DH2','SKU1',1,'Product 1','Cai',1,100,0,0,100);`);
  const migration=process.env.PHUB_ENGAGEMENT_MIGRATION||'Backend/migrations/20261105093025_crm_surveys_reviews.sql';
  await db.exec(fs.readFileSync(path.join(root,migration),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'Backend/migrations/20261105093601_survey_answer_recipient_index.sql'),'utf8'));
  const uniqueReviewMigration=fs.readdirSync(path.join(root,'Backend/migrations')).find(name=>name.endsWith('_unique_customer_product_review.sql'));
  assert.ok(uniqueReviewMigration,'The one-review-per-product upgrade must be present');
  await db.exec(fs.readFileSync(path.join(root,'Backend/migrations',uniqueReviewMigration),'utf8'));
  const legacy=(await db.query(`select public.crm_review_write_v1('TK1','SP1','DH1',5,'Sản phẩm tốt',null) result`)).rows[0].result;
  assert.equal(legacy.trang_thai,'CHO_DUYET');
  const immediateMigration=fs.readdirSync(path.join(root,'Backend/migrations')).find(name=>name.endsWith('_immediate_product_reviews.sql'));
  assert.ok(immediateMigration);
  await db.exec(fs.readFileSync(path.join(root,'Backend/migrations',immediateMigration),'utf8'));
  const productFilterMigration=fs.readdirSync(path.join(root,'Backend/migrations')).find(name=>name.endsWith('_product_review_eligibility_filter.sql'));
  assert.ok(productFilterMigration);
  await db.exec(fs.readFileSync(path.join(root,'Backend/migrations',productFilterMigration),'utf8'));
  const upgraded=(await db.query('select * from public."DANH_GIA_SAN_PHAM" where ma_danh_gia=$1',[legacy.ma_danh_gia])).rows[0];
  assert.equal(upgraded.trang_thai,'HIEN_THI');assert.equal(upgraded.noi_dung,legacy.noi_dung);assert.equal(upgraded.ma_donhang,'DH1');
  await db.exec('set role service_role');
  const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
  const draft={tieu_de:'Nhu cầu laptop',mo_ta:'Khảo sát fixture',loai_doi_tuong:'DO_TUOI',tuoi_tu:18,tuoi_den:24,han_tra_loi:'2099-12-01T00:00:00Z',questions:[
    {noi_dung:'Nhu cầu sử dụng?',loai_cau_hoi:'MOT_LUA_CHON',nhom_noi_dung:'SO_THICH',bat_buoc:true,options:[{noi_dung:'Gaming',cho_phep_nhap_khac:false},{noi_dung:'Khác',cho_phep_nhap_khac:true}]},
    {noi_dung:'Hài lòng?',loai_cau_hoi:'DIEM_1_5',nhom_noi_dung:'HAI_LONG',bat_buoc:true,options:[]},
    {noi_dung:'Góp ý',loai_cau_hoi:'VAN_BAN',nhom_noi_dung:'CHUNG',bat_buoc:false,options:[]}]};
  const id=randomUUID();
  let detail=await rpc('crm_survey_write_v1',['AD1',id,'create',JSON.stringify(draft),null]);
  assert.equal(detail.questions.length,3);
  assert.deepEqual(await rpc('crm_survey_write_v1',['AD1',id,'create',JSON.stringify(draft),null]),detail,'Create retry cannot create duplicates');
  await assert.rejects(rpc('crm_survey_write_v1',['AD1',id,'create',JSON.stringify({...draft,tieu_de:'Different'}),null]),e=>e.code==='40001');
  const preview=await rpc('crm_survey_read_v1',['AD1',true,'preview',id,1]);
  assert.equal(preview.total,1); assert.equal(preview.data[0].ma_kh,'KH1');
  const draftVersion=detail.survey.phien_ban;
  detail=await rpc('crm_survey_write_v1',['AD1',id,'publish','{}',draftVersion]);
  assert.equal(detail.survey.trang_thai,'DANG_MO');
  assert.equal((await rpc('crm_survey_read_v1',['TK1',false,'list',null,1])).total,1);
  assert.equal((await rpc('crm_survey_read_v1',['TK2',false,'list',null,1])).total,0);
  assert.deepEqual(await rpc('crm_survey_write_v1',['AD1',id,'publish','{}',draftVersion]),detail);
  await assert.rejects(rpc('crm_survey_write_v1',['AD1',id,'update',JSON.stringify(draft),detail.survey.phien_ban]),e=>e.code==='23514');
  await db.exec(`update public."KHACH_HANG" set ngay_sinh=(current_date-interval '35 years')::date where ma_kh='KH1';`);
  assert.equal((await rpc('crm_survey_read_v1',['AD1',true,'preview',id,1])).total,1,'Published audience is fixed');
  await assert.rejects(rpc('crm_survey_read_v1',['TK2',false,'detail',id,1]),e=>e.code==='P0002');
  const questions=detail.questions, other=questions[0].options.find(o=>o.cho_phep_nhap_khac);
  const answers=[{ma_cau_hoi:questions[0].ma_cau_hoi,ma_lua_chon:other.ma_lua_chon,noi_dung:'Lập trình'}, {ma_cau_hoi:questions[1].ma_cau_hoi,diem:5}];
  await assert.rejects(rpc('crm_survey_submit_v1',['TK1',id,randomUUID(),JSON.stringify([{ma_cau_hoi:questions[0].ma_cau_hoi,ma_lua_chon:other.ma_lua_chon}])]),e=>e.code==='23514');
  await assert.rejects(rpc('crm_survey_submit_v1',['TK1',id,randomUUID(),JSON.stringify([answers[0]])]),e=>e.code==='23514');
  assert.equal((await db.query('select count(*)::int n from public."TRA_LOI_KHAO_SAT"')).rows[0].n,0,'Incomplete bài rolls all answers back');
  const key=randomUUID(); const submitted=await rpc('crm_survey_submit_v1',['TK1',id,key,JSON.stringify(answers)]);
  assert.ok(submitted.recipient.hoan_thanh_luc); assert.equal(submitted.answers.length,2);
  assert.deepEqual(await rpc('crm_survey_submit_v1',['TK1',id,key,JSON.stringify([...answers].reverse())]),submitted);
  await assert.rejects(rpc('crm_survey_submit_v1',['TK1',id,randomUUID(),JSON.stringify(answers)]),e=>e.code==='40001');
  const stats=await rpc('crm_survey_read_v1',['AD1',true,'statistics',id,1]);
  assert.equal(stats.sent,1);assert.equal(stats.completed,1);assert.equal(stats.questions[1].average,5);assert.equal(stats.questions[0].texts[0],'Lập trình');
  const unknownId=randomUUID();let unknown=await rpc('crm_survey_write_v1',['AD1',unknownId,'create',JSON.stringify({...draft,loai_doi_tuong:'CHUA_NGAY_SINH',tuoi_tu:null,tuoi_den:null}),null]);
  assert.equal((await rpc('crm_survey_read_v1',['AD1',true,'preview',unknownId,1])).data[0].ma_kh,'KH3');
  await assert.rejects(rpc('crm_survey_write_v1',['TK1',unknownId,'publish','{}',unknown.survey.phien_ban]),e=>e.code==='42501');
  const eligible=await rpc('crm_review_read_v1',['TK1','eligible',null,null,1]); assert.equal(eligible.total,1,'Same SKU split over warehouse lines appears once');
  assert.equal((await rpc('crm_review_read_v1',['TK1','eligible','SP1',null,1])).total,1);
  assert.equal((await rpc('crm_review_read_v1',['TK1','eligible','SP2',null,1])).total,0,'No purchase for this specific product');
  assert.equal((await rpc('crm_review_read_v1',['TK2','eligible','SP1',null,1])).total,0,'Never return another customer purchase');
  await assert.rejects(rpc('crm_review_write_v1',['TK1','SP1','DH2',5,'Not completed',null]),e=>e.code==='42501');
  await assert.rejects(rpc('crm_review_write_v1',['TK2','SP1','DH1',5,'Other owner',null]),e=>e.code==='42501');
  await assert.rejects(rpc('crm_review_write_v1',['TK1','SP2','DH1',5,'Not purchased',null]),e=>e.code==='23514');
  let review=await rpc('crm_review_write_v1',['TK1','SP1','DH1',5,'Sản phẩm tốt',null]); assert.equal(review.trang_thai,'HIEN_THI');
  const originalReviewId=review.ma_danh_gia;
  await db.exec(`insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat)
    values('DH3','KH1','ONLINE','HOAN_THANH',now()+interval '1 day'),('DH4','KH2','ONLINE','HOAN_THANH',now());
    insert into public."CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,thue_suat,tien_thue,thanh_tien)
    values('DH3','SKU1',1,'Product 1','Cai',1,100,0,0,100),('DH4','SKU1',1,'Product 1','Cai',1,100,0,0,100);`);
  const repeatPurchase=await rpc('crm_review_read_v1',['TK1','eligible',null,null,1]);
  assert.equal(repeatPurchase.total,1,'Repeated purchases still show one product');
  assert.equal(repeatPurchase.data[0].ma_donhang,'DH1','Keep original purchase proof');
  assert.equal(repeatPurchase.data[0].ma_danh_gia,originalReviewId);
  assert.equal((await rpc('crm_review_write_v1',['TK1','SP1','DH3',5,'Sản phẩm tốt',null])).ma_danh_gia,originalReviewId,'Same-content retry from another purchase reuses the review');
  await assert.rejects(rpc('crm_review_write_v1',['TK1','SP1','DH3',3,'Cannot insert a second review',null]),e=>e.code==='40001');
  await assert.rejects(db.query(`insert into public."DANH_GIA_SAN_PHAM"(ma_kh,ma_sp,ma_donhang,so_sao,noi_dung) values('KH1','SP1','DH3',4,'Duplicate')`),e=>e.code==='23505','Database blocks duplicates even outside the RPC');
  let visible=await rpc('crm_review_read_v1',[null,'public','SP1',null,1]); assert.equal(visible.total,1);assert.equal(visible.average,5);
  assert.ok(!JSON.stringify(visible).includes('DH1')&&!JSON.stringify(visible).includes('ma_kh'));
  const oldVersion=review.phien_ban;
  review=await rpc('crm_review_write_v1',['TK1','SP1','DH3',4,'Đã cập nhật nhận xét',oldVersion]);assert.equal(review.trang_thai,'HIEN_THI');
  assert.equal(review.ma_danh_gia,originalReviewId);assert.equal(review.ma_donhang,'DH1','Editing after a repeat purchase does not rewrite purchase proof');
  assert.equal(review.nguoi_duyet,null);assert.equal(review.ngay_duyet,null);
  assert.equal((await db.query(`select count(*)::int n from public."DANH_GIA_SAN_PHAM" where ma_kh='KH1' and ma_sp='SP1'`)).rows[0].n,1);
  await assert.rejects(rpc('crm_review_write_v1',['TK1','SP1','DH1',2,'Stale edit',oldVersion]),e=>e.code==='40001');
  await assert.rejects(rpc('crm_review_moderate_v1',['AD1',review.ma_danh_gia,'HIEN_THI',oldVersion]),e=>e.code==='40001');
  assert.equal((await rpc('crm_review_read_v1',[null,'public','SP1',null,1])).average,4,'Edited rating is public immediately');
  review=await rpc('crm_review_moderate_v1',['AD1',review.ma_danh_gia,'AN',review.phien_ban]);
  assert.equal((await rpc('crm_review_read_v1',[null,'public','SP1',null,1])).total,0);
  const hiddenVersion=review.phien_ban;
  review=await rpc('crm_review_write_v1',['TK1','SP1','DH1',2,'Edited while hidden',hiddenVersion]);
  assert.equal(review.trang_thai,'AN','Customer cannot undo an explicit hide by editing');assert.equal(review.nguoi_duyet,'AD1');
  assert.equal((await rpc('crm_review_read_v1',[null,'public','SP1',null,1])).total,0);
  await assert.rejects(rpc('crm_review_moderate_v1',['AD1',review.ma_danh_gia,'HIEN_THI',hiddenVersion]),e=>e.code==='40001');
  review=await rpc('crm_review_moderate_v1',['AD1',review.ma_danh_gia,'HIEN_THI',review.phien_ban]);
  assert.equal((await rpc('crm_review_read_v1',[null,'public','SP1',null,1])).average,2);
  const another=await rpc('crm_review_write_v1',['TK2','SP1','DH4',3,'Different customer',null]);
  assert.equal(another.ma_kh,'KH2');assert.equal(another.trang_thai,'HIEN_THI');
  visible=await rpc('crm_review_read_v1',[null,'public','SP1',null,1]);assert.equal(visible.total,2);assert.equal(visible.average,2.5);
  await assert.rejects(db.query(`update public."DANH_GIA_SAN_PHAM" set trang_thai='CHO_DUYET' where ma_danh_gia=$1`,[review.ma_danh_gia]),e=>e.code==='23514');
  assert.equal((await rpc('crm_survey_read_v1',['AD1',true,'report',null,1])).total_customers,4);
  for(const role of ['anon','authenticated']){
    await db.exec('reset role; set role '+role);
    await assert.rejects(rpc('crm_survey_read_v1',['AD1',true,'list',null,1]),e=>e.code==='42501');
    await assert.rejects(db.query('select * from public."TRA_LOI_KHAO_SAT"'),e=>e.code==='42501');
  }
  console.log('PASS: six-table migration, age/unknown targeting, fixed audience, versions/retries, Other/required atomic submission, ownership, purchased review eligibility, moderation, privacy and RLS grants. Isolated PostgreSQL.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

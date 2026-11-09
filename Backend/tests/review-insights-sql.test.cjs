/** Isolated PostgreSQL only. Real actor guard; no network or live reviews. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE||'@electric-sql/pglite');
const sql=name=>fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8');
(async()=>{const db=await PGlite.create();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema admin_ops;
 create table public."NHAN_VIEN"(ma_nhan_vien text primary key,loai_nhan_vien text,trang_thai int);
 create table public."TAI_KHOAN"(ma_tk text primary key,ma_nhan_vien text references public."NHAN_VIEN",trang_thai int);
 create table public."SAN_PHAM"(ma_sp text primary key,sku text,ten_sp text);
 create table public."KHACH_HANG"(ma_kh text primary key,ten_kh text);
 create table public."DANH_GIA_SAN_PHAM"(ma_danh_gia uuid primary key default gen_random_uuid(),ma_sp text references public."SAN_PHAM",ma_kh text references public."KHACH_HANG",so_sao int check(so_sao between 1 and 5),noi_dung text,trang_thai text,ngay_tao timestamptz,cap_nhat_luc timestamptz default now());
 grant usage on schema public,admin_ops to service_role;grant select on all tables in schema public to service_role;
 grant update on public."TAI_KHOAN",public."NHAN_VIEN" to service_role;
 insert into public."NHAN_VIEN" values('NV1','ADMIN',1),('NV2','NHAN_VIEN',1);
 insert into public."TAI_KHOAN" values('AD1','NV1',1),('STAFF','NV2',1),('INACTIVE','NV1',0);
 insert into public."KHACH_HANG" values('KH1','Customer');
 insert into public."SAN_PHAM" values('A','SKU_A','Alpha_100%'),('B','SKU_B','Beta'),('C','SKU_C','Gamma'),('D','SKU_D','Older');
 insert into public."DANH_GIA_SAN_PHAM"(ma_sp,ma_kh,so_sao,noi_dung,trang_thai,ngay_tao) values
 ('A','KH1',1,'low A','HIEN_THI','2026-10-31T17:30:00Z'),
 ('C','KH1',2,'low C1','HIEN_THI','2026-11-01T16:59:58Z'),('C','KH1',2,'low C2','HIEN_THI','2026-11-01T16:59:59Z'),
 ('C','KH1',5,'outside next VN day','HIEN_THI','2026-11-01T17:00:00Z'),('D','KH1',5,'older','HIEN_THI','2026-10-30T00:00:00Z'),
 ('B','KH1',1,'hidden','AN','2026-11-01T15:00:00Z');
 insert into public."DANH_GIA_SAN_PHAM"(ma_sp,ma_kh,so_sao,noi_dung,trang_thai,ngay_tao)
 select 'B','KH1',4,'positive','HIEN_THI','2026-11-01T15:00:00Z' from generate_series(1,9);`);
 const actor=sql('20261028132157_admin_operations.sql').match(/create function admin_ops\.actor\(p_actor text\)[\s\S]*?end \$\$;/);
 assert.ok(actor);await db.exec(actor[0]);
 await db.exec('revoke all on function admin_ops.actor(text) from public,anon,authenticated;grant execute on function admin_ops.actor(text) to service_role;');
 await db.exec(sql('20261109075759_admin_review_insights.sql'));
 const rpc=async(options={})=>(await db.query('select public.crm_review_insights_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',[
  options.actor??'AD1',options.q??'',options.from??null,options.to??null,options.minimum??1,options.sort??'LOW_RATING',options.page??1,options.product??null,options.reviewPage??1,options.lowOnly??false])).rows[0].result;
 await db.exec('set role service_role');
 const all=await rpc();assert.equal(all.total,4);assert.equal(all.summary.reviews,14);assert.equal(all.summary.average,3.64,'Weighted across reviews, never average product averages');
 assert.equal(all.summary.low_count,3);assert.equal(all.summary.low_rate,21.43);assert.deepEqual(all.data.map(p=>p.ma_sp),['C','A','B','D']);
 const window=await rpc({from:'2026-11-01',to:'2026-11-01'});assert.equal(window.summary.reviews,12);assert.equal(window.summary.average,3.42);assert.equal(window.summary.low_rate,25);
 const minimum=await rpc({minimum:5});assert.equal(minimum.total,1);assert.equal(minimum.data[0].ma_sp,'B');assert.equal(minimum.summary.reviews,9);assert.equal(minimum.summary.average,4);
 assert.equal((await rpc({q:'%'})).total,1,'Literal search');assert.equal((await rpc({q:'sku_b'})).data[0].ma_sp,'B');
 assert.deepEqual((await rpc({sort:'LOWEST_SCORE'})).data.map(p=>p.ma_sp),['A','C','B','D']);
 const detail=await rpc({product:'C',from:'2026-11-01',to:'2026-11-01',lowOnly:true});assert.equal(detail.details.total,2);assert.ok(detail.details.data.every(r=>r.so_sao<=2));
 assert.equal((await rpc({product:'C'})).details.total,3);assert.equal((await rpc({product:'C',from:'2026-11-01',to:'2026-11-01'})).details.total,2,'Details use same date bounds as aggregates');
 for(const actor of ['STAFF','INACTIVE','UNKNOWN'])await assert.rejects(rpc({actor}),/ADMIN_FORBIDDEN/);
 for(const options of [{minimum:0},{sort:'BAD'},{page:0},{from:'2026-11-02',to:'2026-11-01'}])await assert.rejects(rpc(options),e=>e.code==='23514');
 await assert.rejects(rpc({minimum:5,product:'A'}),e=>e.code==='P0002');
 await db.exec(`reset role;insert into public."SAN_PHAM" select 'PAGE'||i,'PAGE'||i,'Pagination '||i from generate_series(1,21) i;
 insert into public."DANH_GIA_SAN_PHAM"(ma_sp,ma_kh,so_sao,noi_dung,trang_thai,ngay_tao) select ma_sp,'KH1',4,'page','HIEN_THI','2026-11-01T15:00:00Z' from public."SAN_PHAM" where ma_sp like 'PAGE%';
 set role service_role;`);
 const p1=await rpc(),p2=await rpc({page:2});assert.equal(p1.data.length,20);assert.equal(p2.data.length,5);assert.equal(new Set([...p1.data,...p2.data].map(p=>p.ma_sp)).size,25);assert.deepEqual(p1.summary,p2.summary,'Totals span all pages');
 const before=(await db.query('select count(*)::int n,sum(so_sao)::int s from public."DANH_GIA_SAN_PHAM"')).rows[0];
 await rpc({product:'B'});assert.deepEqual((await db.query('select count(*)::int n,sum(so_sao)::int s from public."DANH_GIA_SAN_PHAM"')).rows[0],before);
 for(const role of ['anon','authenticated'])assert.equal((await db.query('select has_function_privilege($1,$2,$3) ok',[role,'public.crm_review_insights_v1(text,text,date,date,integer,text,integer,text,integer,boolean)','EXECUTE'])).rows[0].ok,false);
 console.log('Review insights SQL: weighted scores, visibility, VN date bounds, sample thresholds, ranking, drilldown, pagination and permissions passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

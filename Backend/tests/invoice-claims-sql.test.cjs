// Isolated PostgreSQL fixtures. Never reads .env or touches hosted orders.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {randomUUID} = require('node:crypto');
const {PGlite} = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const sql = name => fs.readFileSync(path.join(root, 'Backend/migrations', name), 'utf8');
(async () => {
 const db = await PGlite.create();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
  await db.exec(sql('001_initial_schema.sql'));
  await db.exec(sql('20261023_customer_support.sql'));
  await db.exec(sql('20261028132157_admin_operations.sql'));
  await db.exec('alter table public."KHACH_HANG" add column ngay_sinh date, add column luu_tru_luc timestamptz;');
  await db.exec(sql('20261105093025_crm_surveys_reviews.sql'));
  await db.exec(`insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(1,'Store','Address'),(2,'Other','Other address');
   insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('NV1','ADMIN','Admin',null),('NV2','NHAN_VIEN','Staff',1);
   insert into public."KHACH_HANG"(ma_kh,ten_kh) values('KH1','Customer 1'),('KH2','Customer 2');
   insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh,ma_nhan_vien) values
    ('TK1','customer1','fixture','KH1',null),('TK2','customer2','fixture','KH2',null),('AD1','admin','fixture',null,'NV1'),('STAFF','staff','fixture',null,'NV2');
   insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat,ten_nguoi_nhan) values
    ('DH1',null,'TAI_QUAY','HOAN_THANH',now(),'Original buyer'),('DH2','KH2','TAI_QUAY','HOAN_THANH',now(),'Other buyer'),
    ('DH3',null,'ONLINE','HOAN_THANH',now(),'Online'),('DH4',null,'TAI_QUAY','HUY',now(),'Cancelled');
   insert into public."HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap) values
    ('HD1','DH1',now(),'Original buyer',100,10,110,'NV1'),('HD2','DH2',now(),'Other buyer',100,10,110,'NV1'),
    ('HD3','DH3',now(),'Online',100,10,110,'NV1'),('HD4','DH4',now(),'Cancelled',100,10,110,'NV1');
   insert into public."LOAI_SP"(ma_loai_sp,ten_loai_sp) values('L1','Category');
   insert into public."LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('L2','Child','L1');
   insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai) values('SP1','SKU1','Product 1','L1','L2',100);
   insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'SKU1',100),(2,'SKU1',10);
   insert into public."CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,thue_suat,tien_thue,thanh_tien) values('DH1','SKU1',1,'Product 1','Cai',1,100,10,10,110);`);
  const migration = fs.readdirSync(path.join(root,'Backend/migrations')).find(x => x.endsWith('_counter_invoice_claims.sql'));
  await db.exec(sql(migration));
  await db.exec('set role service_role');
  const rpc = async (name,args) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
  const create = (invoice, actor='TK1', key=randomUUID(), evidence='Bought at store on the date printed') => rpc('customer_invoice_claim_v1',[actor,key,invoice,evidence]);
  const read = (id, actor='STAFF') => rpc('staff_invoice_claim_read_v1',[actor,id,1]);
  const approve = (detail, actor='STAFF', key=randomUUID(), version=detail.invoice_version) => rpc('staff_invoice_claim_decide_v1',[
    actor,detail.ticket.ma_phan_hoi,key,detail.ticket.phien_ban_lien_ket,'approve','Verified original invoice in person',true,version]);
  const key=randomUUID(), claim=await create('HD1','TK1',key);
  assert.equal(claim.ma_donhang,null,'A request alone never grants access to the order');
  assert.equal(claim.ket_qua_lien_ket,null); assert.equal(claim.ma_kh,'KH1');
  assert.deepEqual(await create('HD1','TK1',key),claim,'Exact retry does not create a second ticket');
  await assert.rejects(create('HD2','TK1',key),e=>e.code==='40001');
  await assert.rejects(create('HD1'),e=>e.code==='23505','No duplicate pending claims');
  const missing=await create('UNKNOWN'); assert.equal(missing.ma_donhang,null,'Unknown invoice accepted without existence disclosure');
  await assert.rejects(read(claim.ma_phan_hoi,'TK1'),e=>e.code==='42501');
  await assert.rejects(create('HD1','STAFF'),e=>e.code==='42501');
  const competing=await create('HD1','TK2');
  const beforeInvoice=(await db.query('select to_jsonb(i) row from public."HOA_DON" i where ma_hoadon=\'HD1\'')).rows[0].row;
  const beforeStock=(await db.query('select jsonb_agg(to_jsonb(t)) rows from public."TON_KHO" t')).rows[0].rows;
  const detail=await read(claim.ma_phan_hoi); assert.equal(detail.can_link,true);
  await assert.rejects(approve(detail,'STAFF',randomUUID(),'0'.repeat(64)),e=>e.code==='40001','Invoice snapshot must be verified');
  const decisionKey=randomUUID(), linked=await approve(detail,'STAFF',decisionKey);
  assert.equal(linked.ticket.ket_qua_lien_ket,'DA_LIEN_KET');assert.equal(linked.ticket.tai_khoan_xac_minh,'STAFF');
  assert.deepEqual(await approve(detail,'STAFF',decisionKey),linked,'Approval retry uses exact prior response');
  await assert.rejects(approve(detail),e=>e.code==='40001','Stale decision cannot overwrite the audit');
  assert.equal((await db.query('select ma_kh,trang_thai from public."DON_HANG" where ma_donhang=\'DH1\'')).rows[0].ma_kh,'KH1');
  assert.deepEqual((await db.query('select to_jsonb(i) row from public."HOA_DON" i where ma_hoadon=\'HD1\'')).rows[0].row,beforeInvoice,'Invoice snapshot stays unchanged');
  assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(t)) rows from public."TON_KHO" t')).rows[0].rows,beforeStock,'No stock mutation');
  await assert.rejects(approve(await read(competing.ma_phan_hoi)),e=>e.code==='40001','Second customer cannot steal already linked order');
  assert.equal((await rpc('crm_review_read_v1',['TK1','eligible',null,null,1])).data[0].ma_donhang,'DH1','Completed linked purchase immediately enables review');
  for (const invoice of ['HD2','HD3','HD4']) {
    const invalid=await create(invoice);const invalidDetail=await read(invalid.ma_phan_hoi);
    assert.equal(invalidDetail.can_link,false);await assert.rejects(approve(invalidDetail),e=>e.code==='40001');
  }
  const unknown=await read(missing.ma_phan_hoi); assert.equal(unknown.invoice,null);
  const rejected=await rpc('staff_invoice_claim_decide_v1',['AD1',missing.ma_phan_hoi,randomUUID(),unknown.ticket.phien_ban_lien_ket,'reject','No original invoice available',false,null]);
  assert.equal(rejected.ticket.ket_qua_lien_ket,'TU_CHOI');
  assert.equal(rejected.ticket.ma_donhang,null);
  const catalog=await rpc('staff_counter_catalog_v1',['STAFF','customers','customer']); assert.equal(catalog.data.length,2);
  assert.ok(catalog.data.every(c=>!('mat_khau_hash' in c)));
  const products=await rpc('staff_counter_catalog_v1',['STAFF','products','SKU1']); assert.equal(products.data.length,1);assert.equal(products.data[0].warehouse_id,1);
  const posKey=randomUUID(),posBody={customer_id:'KH1',recipient:'Customer 1',lines:[{sku:'SKU1',warehouse_id:1,unit_price:'100',quantity:1}]};
  const pos=await rpc('admin_operation_v1',['STAFF','orders','create',posKey,null,JSON.stringify(posBody)]);
  assert.equal(pos.data[0].ma_kh,'KH1');assert.equal(pos.data[0].kenh_ban,'TAI_QUAY');
  assert.equal((await rpc('admin_operation_v1',['STAFF','orders','create',posKey,null,JSON.stringify(posBody)])).replayed,true);
  await assert.rejects(rpc('admin_operation_v1',['STAFF','orders','create',randomUUID(),null,JSON.stringify({...posBody,lines:[{...posBody.lines[0],warehouse_id:2}]})]),e=>e.code==='42501');
  await assert.rejects(rpc('admin_operation_v1',['STAFF','orders','confirm',randomUUID(),'DH1','{}']),/ADMIN_FORBIDDEN/);
  await db.exec('update public."TAI_KHOAN" set trang_thai=2 where ma_tk=\'TK2\'');
  assert.equal((await rpc('staff_counter_catalog_v1',['STAFF','customers','customer'])).data.length,1);
  await assert.rejects(create('HD1','TK2'),e=>e.code==='42501');
  await db.exec('update public."TAI_KHOAN" set trang_thai=2 where ma_tk=\'STAFF\'');
  await assert.rejects(read(claim.ma_phan_hoi),e=>e.code==='42501');
  for (const role of ['anon','authenticated']) {
    await db.exec('reset role; set role '+role);
    await assert.rejects(read(claim.ma_phan_hoi),e=>e.code==='42501');
    await assert.rejects(create('HD1'),e=>e.code==='42501');
  }
  console.log('PASS: invoice-claim privacy, ownership, retry/version checks, audit, immutable invoice/stock, review eligibility, counter-sale roles/warehouse and service-only grants. Isolated PostgreSQL.');
 } finally { await db.close(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});

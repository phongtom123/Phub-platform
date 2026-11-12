// Real PostgreSQL functions in an isolated fixture; no Supabase credentials/network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const read = name => fs.readFileSync(path.resolve(__dirname, '../migrations', name), 'utf8');
const repair = '20261112050923_restore_manual_invoice_workflow.sql';

(async () => {
 const db = await PGlite.create();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
  for (const name of [
   '001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
   '20261022_crm_customer_profile_interests.sql', '20261022_crm_admin_profile_api.sql',
   '20261023012955_remove_customer_interests.sql', '20261023_customer_support.sql',
   '20261024161801_account_plaintext_passwords.sql', '20261028132157_admin_operations.sql',
   '20261028154622_disable_transfers_single_warehouse.sql', '20261029162141_warehouse_receipts.sql',
   '20261030023519_receipt_sale_pricing.sql', '20261030034222_fixed_operating_warehouse.sql',
   '20261030151651_simplify_receipt_pricing.sql', '20261101162759_unlock_warehouses.sql',
   '20261104100000_admin_order_history.sql', '20261105083031_customer_soft_delete.sql',
   '20261105093025_crm_surveys_reviews.sql', '20261106083600_counter_invoice_claims.sql',
   '20261106142849_staff_operational_workspace.sql', '20261107030114_counter_buyer_email.sql',
   '20261109065207_account_soft_delete.sql',
  ]) {
   await db.exec(read(name));
   if (name === '001_initial_schema.sql') await db.exec(`insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(2,'Store 2','Address');`);
  }
  await db.exec(read(repair));
  await db.exec(read(repair));
  await db.exec(`
   insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(1,'Store 1','Address') on conflict do nothing;
   insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('NV1','ADMIN','Admin',null),('NV2','NHAN_VIEN','Staff',1);
   insert into public."KHACH_HANG"(ma_kh,ten_kh) values('KH1','Customer');
   insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_nhan_vien) values('AD1','admin','fixture-only-password','NV1'),('STAFF','staff','fixture-only-password','NV2');
   insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_kh,email) values('CUSTOMER','customer','fixture-only-password','KH1','customer@example.com');
   insert into public."LOAI_SP"(ma_loai_sp,ten_loai_sp) values('L1','Components');
   insert into public."LOAI_SP_CON"(ma_loai_sp_con,ma_loai_sp,ten_loai_sp_con) values('C1','L1','CPU');
   insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai) values('SP1','SKU1','Product','L1','C1',100);
   insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'SKU1',20);
   set role service_role;
  `);
  const rpc = async (name,args) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
  const stock = async () => (await db.query('select so_luong_ton from public."TON_KHO" where ma_kho=1 and sku=$1',['SKU1'])).rows[0].so_luong_ton;
  const options = await rpc('warehouse_manual_invoice_options_v1',['STAFF']);
  assert.equal(options.warehouse_id,1);
  assert.equal(options.data[0].available,20);
  const customers = await rpc('warehouse_invoice_customer_search_v1',['STAFF',' CUSTOMER@EXAMPLE.COM ']);
  assert.equal(customers.customers[0].ma_kh,'KH1');
  assert.equal('mat_khau' in customers.customers[0],false);
  const body = {buyer:'Walk-in customer',email:'walkin@example.com',lines:[{sku:'SKU1',quantity:2,unit_price:'100',discount:'10'}]};
  const key = randomUUID();
  const create = (actor,requestKey,data,warehouse=1) => rpc('warehouse_manual_invoice_v1',[actor,requestKey,warehouse,JSON.stringify(data)]);
  const result = await create('STAFF',key,body);
  assert.equal(result.replayed,false);
  assert.equal(Number(result.data[0].total),209);
  assert.equal(await stock(),18);
  const invoice = (await db.query('select * from public."HOA_DON" where ma_hoadon=$1',[result.data[0].id])).rows[0];
  assert.equal(invoice.email_nguoi_mua,'walkin@example.com');
  assert.equal(Number(invoice.tong_tien_truoc_thue),190);
  assert.equal(Number(invoice.tong_tien_thue),19);
  assert.equal((await db.query('select count(*)::int n from public."THANH_TOAN"')).rows[0].n,0,'An invoice must not fabricate a payment');
  const replay = await create('STAFF',key,body);
  assert.equal(replay.replayed,true);
  assert.equal(replay.data[0].id,result.data[0].id);
  assert.equal(await stock(),18,'Replay must not deduct stock twice');
  assert.equal((await db.query('select count(*)::int n from public."HOA_DON"')).rows[0].n,1);
  await assert.rejects(create('STAFF',key,{...body,buyer:'Changed buyer'}),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(create('STAFF',randomUUID(),{...body,lines:[{...body.lines[0],quantity:1000}]}),/INSUFFICIENT_STOCK/);
  assert.equal(await stock(),18);
  assert.equal((await db.query('select count(*)::int n from public."DON_HANG"')).rows[0].n,1,'A rejected invoice leaves no order');
  for (const actor of ['AD1','CUSTOMER']) await assert.rejects(create(actor,randomUUID(),body), e=>e.code==='42501'||e.message==='ADMIN_FORBIDDEN');
  await assert.rejects(create('STAFF',randomUUID(),body,2),/WAREHOUSE_FORBIDDEN/);
  await db.exec('reset role; update public."KHO" set trang_thai=0 where ma_kho=1; set role service_role');
  await assert.rejects(create('STAFF',randomUUID(),body),/WAREHOUSE_FORBIDDEN/);
  await assert.rejects(rpc('warehouse_manual_invoice_options_v1',['STAFF']),/WAREHOUSE_FORBIDDEN/);
  assert.equal(await stock(),18);
  for (const role of ['anon','authenticated']) for (const signature of [
   'public.warehouse_manual_invoice_options_v1(text)',
   'public.warehouse_invoice_customer_search_v1(text,text)',
   'public.warehouse_manual_invoice_v1(text,uuid,integer,jsonb)',
  ]) assert.equal((await db.query('select has_function_privilege($1,$2,$3) allowed',[role,signature,'EXECUTE'])).rows[0].allowed,false);
  console.log('PASS: manual invoice options/email search, atomic creation, tax totals, replay, stock deduction, invalid stock/warehouse, roles, and service-only grants.');
 } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

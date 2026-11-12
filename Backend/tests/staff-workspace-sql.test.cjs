// Role migration and real business RPCs in an isolated PostgreSQL fixture only.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const migrations = path.resolve(__dirname, '../migrations');
const sql = name => fs.readFileSync(path.join(migrations, name), 'utf8');
(async () => {
 const db = await PGlite.create();
 try {
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
   '20261107030114_counter_buyer_email.sql',
   '20261112140000_register_links_counter_orders.sql',
  ];
  for (const name of names) {
   try {
    await db.exec(sql(name));
    if (name === '001_initial_schema.sql') await db.exec(`insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(2,'Store 2','Address');`);
   } catch (error) { throw new Error(`Migration ${name}: ${error.message}`); }
  }
  await db.exec(`
   insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(1,'Store 1','Address'),(2,'Store 2','Address') on conflict do nothing;
   insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('NV1','ADMIN','Admin',null),('NV2','NHAN_VIEN','Staff',1);
   insert into public."KHACH_HANG"(ma_kh,ten_kh) values('KH1','Customer');
   insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_nhan_vien) values('AD1','admin','fixture-only-password','NV1'),('STAFF','staff','fixture-only-password','NV2');
   insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau,ma_kh,email) values('CUSTOMER','customer','fixture-only-password','KH1','customer@example.com');
   insert into public."NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(1,'Supplier');
   insert into public."LOAI_SP"(ma_loai_sp,ten_loai_sp) values('L1','Components');
   insert into public."LOAI_SP_CON"(ma_loai_sp_con,ma_loai_sp,ten_loai_sp_con) values('C1','L1','CPU');
   insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai) values('SP1','SKU1','Product','L1','C1',100);
   insert into public."PHIEU_NHAP"(ma_phieu_nhap,ma_phieu_code,ma_ncc,ma_kho,trang_thai,nguoi_tao,ngay_tao) values(1,'PN1',1,1,'NHAP','NV2',now()),(2,'PN2',1,2,'NHAP','NV2',now());
  `);
  await db.exec('set role service_role');
  const rpc = async (name, args) => (await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`, args)).rows[0].result;
  const forbidden = promise => assert.rejects(promise, e => e.code === '42501' || e.message === 'ADMIN_FORBIDDEN');
  assert.equal((await rpc('public.warehouse_read_v1',['STAFF','receipts','{}'])).total,2,'Staff reads both warehouses');
  await forbidden(rpc('public.warehouse_read_v1',['AD1','receipts','{}']));
  await forbidden(rpc('public.admin_read_v1',['STAFF','summary','{}']));
  const summary = await rpc('public.admin_read_v1',['AD1','summary','{}']);
  assert.equal(summary.counts.orders,0,'Admin keeps aggregates');
  await forbidden(rpc('public.admin_read_v1',['AD1','settings','{}']));
  assert.equal((await rpc('public.admin_read_v1',['STAFF','settings','{}'])).store_name,'PHUB');
  await forbidden(rpc('public.admin_operation_v1',['AD1','notifications','read',randomUUID(),null,JSON.stringify({ids:[]})]));
  await forbidden(rpc('public.admin_update_customer_profile_v2',['KH1','AD1','{"ten_kh":"No"}']));
  assert.equal((await rpc('public.admin_update_customer_profile_v2',['KH1','STAFF','{"ten_kh":"Updated"}'])).profile.ten_kh,'Updated');
  await forbidden(rpc('public.crm_survey_read_v1',['STAFF',true,'report',null,1]));
  assert.ok(await rpc('public.crm_survey_read_v1',['AD1',true,'report',null,1]));
  await forbidden(rpc('public.crm_survey_write_v1',['AD1',randomUUID(),'create','{}',null]));
  await forbidden(rpc('public.crm_review_read_v1',['AD1','admin',null,null,1]));
  await forbidden(rpc('admin_ops.counter_actor',['AD1']));
  await forbidden(rpc('admin_ops.staff_actor',['CUSTOMER']));
  // Employee assigned to warehouse 1 edits/confirms a document in warehouse 2.
  const draft = await rpc('public.warehouse_read_v1',['STAFF','receipt','{"id":2}']);
  const edit = {supplier_id:1,note:'Fixture',expected_version:draft.version,lines:[{sku:'SKU1',quantity:7,unit_price:'80.00'}]};
  const editKey = randomUUID();
  const saved = await rpc('public.priced_receipt_v1',['STAFF','WAREHOUSE','update',editKey,2,JSON.stringify(edit)]);
  assert.equal(saved.receipt.ma_kho,2);
  assert.equal(saved.lines[0].quantity,7);
  assert.equal((await rpc('public.priced_receipt_v1',['STAFF','WAREHOUSE','update',editKey,2,JSON.stringify(edit)])).replayed,true);
  const quote = await rpc('public.receipt_pricing_preview_v1',['STAFF',2]);
  const confirm = JSON.stringify({expected_version:saved.version,pricing_version:quote.version});
  const confirmKey = randomUUID();
  const confirmed = await rpc('public.priced_receipt_v1',['STAFF','WAREHOUSE','confirm',confirmKey,2,confirm]);
  assert.equal(confirmed.receipt.trang_thai,'DA_NHAP');
  assert.equal((await rpc('public.priced_receipt_v1',['STAFF','WAREHOUSE','confirm',confirmKey,2,confirm])).replayed,true);
  assert.equal((await db.query('select so_luong_ton from public."TON_KHO" where ma_kho=2 and sku=$1',['SKU1'])).rows[0].so_luong_ton,7,'Retry must not duplicate stock');
  assert.equal((await db.query('select count(*)::int total from public."TON_KHO" where ma_kho=1')).rows[0].total,0,'Must not receive into employee assignment');
  const priced = await rpc('public.priced_receipt_v1',['STAFF','ADMIN','lines',randomUUID(),1,JSON.stringify({lines:[{sku:'SKU1',quantity:3,unit_price:'80.00',markup_rate:'25',taxes:[{code:'VAT',name:'VAT',rate:'10'}]}]})]);
  assert.equal(priced.data[0].ma_phieu_nhap,1,'Shared operational UI retains its response shape');
  const pricedQuote = await rpc('public.receipt_pricing_preview_v1',['STAFF',1]);
  assert.equal(Number(pricedQuote.lines[0].price.pre_tax),100,'Staff can edit markup in shared receipt UI');
  assert.equal(Number(pricedQuote.lines[0].price.after_tax),110);
  const lookup = await rpc('public.staff_counter_customer_email_v1',['STAFF','  CUSTOMER@example.com  ']);
  assert.equal(lookup.data[0].ma_kh,'KH1');
  assert.equal(lookup.data[0].email,'customer@example.com');
  assert.equal((await rpc('public.staff_counter_customer_email_v1',['STAFF','not-found@example.com'])).data.length,0);
  assert.equal('mat_khau' in lookup.data[0],false);
  await forbidden(rpc('public.staff_counter_customer_email_v1',['CUSTOMER','customer@example.com']));
  await db.exec(`insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'SKU1',20);`);
  const guestBody = JSON.stringify({recipient:'Walk-in',buyer_email:'  GUEST@example.com  ',lines:[{sku:'SKU1',warehouse_id:1,quantity:1,unit_price:'80.00'}]});
  const guestKey = randomUUID();
  const guestOrder = await rpc('public.staff_counter_order_email_v1',['STAFF',guestKey,guestBody]);
  assert.equal(guestOrder.data[0].email_nguoi_mua,'guest@example.com');
  assert.equal(guestOrder.data[0].ma_kh,null,'Walk-in email does not assign an account');
  assert.equal((await rpc('public.staff_counter_order_email_v1',['STAFF',guestKey,guestBody])).replayed,true);
  const memberBody = {...JSON.parse(guestBody),customer_id:'KH1',buyer_email:'customer@example.com'};
  const memberOrder = await rpc('public.staff_counter_order_email_v1',['STAFF',randomUUID(),JSON.stringify(memberBody)]);
  assert.equal(memberOrder.data[0].ma_kh,'KH1');
  assert.equal(memberOrder.data[0].email_nguoi_mua,'customer@example.com');
  // A walk-in sale typed with the email of an active customer account is attached immediately.
  const walkInMember = await rpc('public.staff_counter_order_email_v1',['STAFF',randomUUID(),
    JSON.stringify({...JSON.parse(guestBody),buyer_email:' Customer@Example.com '})]);
  assert.equal(walkInMember.data[0].ma_kh,'KH1','Counter sale with an account email links the account');
  assert.equal(walkInMember.data[0].email_nguoi_mua,'customer@example.com');
  const beforeInvalid = (await db.query('select count(*)::int total from public."DON_HANG"')).rows[0].total;
  await assert.rejects(rpc('public.admin_operation_v1',['STAFF','orders','create',randomUUID(),null,JSON.stringify({...memberBody,buyer_email:'wrong@example.com'})]),/BUYER_EMAIL_MISMATCH/);
  await assert.rejects(rpc('public.admin_operation_v1',['STAFF','orders','create',randomUUID(),null,JSON.stringify({...memberBody,buyer_email:null})]),/BUYER_EMAIL_INVALID/);
  assert.equal((await db.query('select count(*)::int total from public."DON_HANG"')).rows[0].total,beforeInvalid,'Invalid buyer must roll back whole order');
  for (const role of ['anon','authenticated']) {
   assert.equal((await db.query('select has_function_privilege($1,$2,$3) permitted',[role,'admin_ops.staff_actor(text)','EXECUTE'])).rows[0].permitted,false);
   for(const signature of ['public.staff_counter_customer_email_v1(text,text)','public.staff_counter_order_email_v1(text,uuid,jsonb)']) {
    assert.equal((await db.query('select has_function_privilege($1,$2,$3) permitted',[role,signature,'EXECUTE'])).rows[0].permitted,false);
   }
  }
  console.log('Staff workspace SQL: role boundary, cross-warehouse receipt update/confirm/replay, CRM and SQL permissions passed.');
 } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

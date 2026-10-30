// Isolated upgrade/integration checks. Never connects to Supabase.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const migrate = name => db.exec(fs.readFileSync(path.resolve(__dirname, '../migrations', name), 'utf8'));
    for (const name of ['001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
      '20261023_customer_support.sql', '20261028132157_admin_operations.sql', '20261029162141_warehouse_receipts.sql',
      '20261030020310_business_report.sql']) await migrate(name);
    await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(1,'Historical','Test'),(2,'Operating','Test');
      insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('AD','ADMIN','Admin',null),('NV','NHAN_VIEN','Staff',2);
      insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','AD'),('W','staff','disabled','NV');
      insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(1,'Supplier'); insert into "LOAI_SP" values('L','Category',1);
      insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
      insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',500000,'unit');
      insert into "PHIEU_NHAP"(ma_phieu_code,ma_ncc,ma_kho,nguoi_tao,trang_thai,ngay_tao,ngay_nhap) values('LEGACY',1,1,'AD','DA_NHAP',now(),now());
      insert into "CT_PHIEU_NHAP"(ma_phieu_nhap,sku,so_luong_nhap,gia_nhap) select ma_phieu_nhap,'S',3,100 from "PHIEU_NHAP" where ma_phieu_code='LEGACY';`);
    await migrate('20261030023519_receipt_sale_pricing.sql');
    const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].r;
    const quote = (id, actor = 'A') => scalar('select public.receipt_pricing_preview_v1($1,$2) as r', [actor, id]);
    const command = (action, id, body, key = randomUUID(), portal = 'ADMIN', actor = 'A') =>
      scalar('select public.priced_receipt_v1($1,$2,$3,$4,$5,$6) as r', [actor, portal, action, key, id, body]);
    const body = { warehouse_id: 2, supplier_id: 1, lines: [{ sku: 'S', quantity: 2, unit_price: '1000000',
      markup_rate: '20', taxes: [{ code: 'VAT', rate: '10' }] }] };
    // Freeze one priced receipt under the old schema; another draft is outside
    // warehouse 2 so migration must preserve it without the warehouse guard failing.
    const old = (await command('create', null, body)).data[0].ma_phieu_nhap;
    await command('confirm', old, { _expected_status: 'NHAP', pricing_version: (await quote(old)).version });
    await command('create', null, { ...body, warehouse_id: 1 });
    await migrate('20261030034222_fixed_operating_warehouse.sql');
    const baseline = await scalar(`select jsonb_build_object('prices',(select jsonb_agg(jsonb_build_array(sku,gia_ban_hien_tai)) from "SAN_PHAM"),
      'stock',(select jsonb_agg(to_jsonb(t) order by ma_kho,sku) from "TON_KHO" t),
      'receipts',(select jsonb_agg(to_jsonb(p) order by ma_phieu_nhap) from "PHIEU_NHAP" p)) as r`);
    const oldPrice = (await quote(old)).lines[0].price;
    await migrate('20261030151651_simplify_receipt_pricing.sql');
    const after = await scalar(`select jsonb_build_object('prices',(select jsonb_agg(jsonb_build_array(sku,gia_ban_hien_tai)) from "SAN_PHAM"),
      'stock',(select jsonb_agg(to_jsonb(t) order by ma_kho,sku) from "TON_KHO" t),
      'receipts',(select jsonb_agg(to_jsonb(p) order by ma_phieu_nhap) from "PHIEU_NHAP" p)) as r`);
    assert.deepEqual(after, baseline, 'upgrade must not change stock, prices or headers');
    const recalculated = (await quote(old)).lines[0].price;
    for (const field of ['profit', 'pre_tax', 'total_tax', 'after_tax']) assert.equal(Number(recalculated[field]), Number(oldPrice[field]));
    assert.equal((await scalar(`select admin_ops.receipt_snapshot(ma_phieu_nhap) as r from "PHIEU_NHAP" where ma_phieu_code='LEGACY'`)).lines[0].pricing, null);
    assert.equal(await scalar(`select count(*)::int as r from information_schema.tables where table_schema in ('public','admin_ops') and table_name in ('THUE','SAN_PHAM_THUE','pricing_defaults','pricing_audit')`), 0);
    assert.deepEqual((await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='CT_PHIEU_NHAP' order by ordinal_position`)).rows.map(r => r.column_name),
      ['ma_phieu_nhap', 'sku', 'so_luong_nhap', 'gia_nhap', 'ty_le_loi_nhuan', 'thue_snapshot']);
    assert.equal(await scalar(`select count(*)::int as r from "CT_PHIEU_NHAP" c, jsonb_array_elements(c.thue_snapshot) t where t ? 'amount'`), 0);
    await db.exec('set role service_role');
    const context = await scalar(`select public.pricing_context_v1('A','S') as r`);
    assert.equal(context.markup_rate, '0'); assert.deepEqual(context.taxes, []); assert.deepEqual(context.catalog, []);
    await assert.rejects(() => scalar(`select public.pricing_config_v1('A',null,'{}') as r`), /PRICING_RECEIPT_ONLY/);
    await assert.rejects(() => scalar(`select public.pricing_tax_v1('A','VAT','VAT',10,true) as r`), /PRICING_RECEIPT_ONLY/);
    const fresh = (await command('create', null, { ...body, lines: [{ ...body.lines[0], taxes: [
      { code: 'CUSTOM', name: 'Local tax', rate: '10' }, { code: 'OTHER', name: 'Other tax', rate: '2' }] }] })).data[0].ma_phieu_nhap;
    let preview = await quote(fresh);
    assert.equal(Number(preview.lines[0].price.after_tax), 1344000);
    assert.equal(preview.lines[0].price.taxes.find(t => t.code === 'CUSTOM').name, 'Local tax');
    const stored = await scalar(`select to_jsonb(c) as r from "CT_PHIEU_NHAP" c where ma_phieu_nhap=$1`, [fresh]);
    assert.ok(stored.thue_snapshot.every(t => !('amount' in t)), 'store inputs only');
    // Optimistic version and stock/price idempotency still work after deleting tables.
    await assert.rejects(() => command('confirm', fresh, { _expected_status: 'NHAP', pricing_version: '0'.repeat(64) }), /PRICING_CHANGED/);
    const confirm = { _expected_status: 'NHAP', pricing_version: preview.version }, key = randomUUID();
    await command('confirm', fresh, confirm, key);
    const once = await scalar(`select so_luong_ton as r from "TON_KHO" where ma_kho=2 and sku='S'`);
    assert.equal((await command('confirm', fresh, confirm, key)).replayed, true);
    assert.equal(await scalar(`select so_luong_ton as r from "TON_KHO" where ma_kho=2 and sku='S'`), once);
    assert.equal(Number(await scalar(`select gia_ban_hien_tai::text as r from "SAN_PHAM" where sku='S'`)), 1200000);
    await assert.rejects(() => db.query(`update "CT_PHIEU_NHAP" set ty_le_loi_nhuan=99 where ma_phieu_nhap=$1`, [fresh]), /PRICING_FROZEN/);
    await assert.rejects(() => command('create', null, { ...body, lines: [{ ...body.lines[0], taxes: [{ code: 'VAT', rate: '10' }, { code: 'VAT', rate: '5' }] }] }), /PRICING_INVALID/);
    await assert.rejects(() => command('create', null, { ...body, lines: [{ ...body.lines[0], taxes: [{ code: 'BAD', rate: '101' }] }] }), /PRICING_INVALID/);
    const staffBody = { supplier_id: 1, lines: [{ sku: 'S', quantity: 1, unit_price: '5' }] };
    let staff = await command('create', null, staffBody, randomUUID(), 'WAREHOUSE', 'W');
    assert.equal(Number(staff.lines[0].pricing.markup_rate), 0);
    assert.deepEqual(staff.lines[0].pricing.taxes, [], 'no implicit VAT 10%');
    const staffId = staff.receipt.ma_phieu_nhap;
    await command('confirm', staffId, { expected_version: staff.version, pricing_version: (await quote(staffId, 'W')).version }, randomUUID(), 'WAREHOUSE', 'W');
    await assert.rejects(() => command('create', null, { ...staffBody, lines: [{ ...staffBody.lines[0], markup_rate: '20' }] }, randomUUID(), 'WAREHOUSE', 'W'), /PRICING_FORBIDDEN/);
    const cancelled = (await command('create', null, body)).data[0].ma_phieu_nhap;
    await command('cancel', cancelled, { _expected_status: 'NHAP' });
    assert.equal(Number((await quote(cancelled)).lines[0].price.after_tax), 1320000);
    console.log('PASS: upgrade preserves existing history/stock/prices; 4 tables and 6 derived/duplicate fields removed; receipt-only taxes; computed API amounts; legacy null history; confirmation/replay/rollback/frozen rules; staff permissions; no forced markup/VAT');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

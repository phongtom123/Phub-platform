// Local PostgreSQL integration checks only. Never connects to Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
    const migrate = name => db.exec(fs.readFileSync(path.resolve(__dirname, '../migrations', name), 'utf8'));
    for (const name of ['001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
      '20261023_customer_support.sql', '20261028132157_admin_operations.sql', '20261029162141_warehouse_receipts.sql',
      '20261030020310_business_report.sql', '20261030023519_receipt_sale_pricing.sql']) await migrate(name);
    await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(2,'Operating warehouse','Test');
      insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('AD','ADMIN','Admin');
      insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','AD');
      insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(1,'Supplier'); insert into "LOAI_SP" values('L','Category',1);
      insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Subcategory','L');`);
    await migrate('20261030034222_fixed_operating_warehouse.sql');
    const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].r;
    const report = (start = '2026-08-02', end = '2026-10-30') => scalar(
      `select public.admin_business_report_v1('A',$1,$2) as r`, [start, end]);
    const stock = async (sku, quantity) => {
      // Fixture setup: do not create an unrelated real-time audit record.
      await db.exec('alter table "TON_KHO" disable trigger phub_stock_audit');
      await db.query(`insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(2,$1,$2)
        on conflict(ma_kho,sku) do update set so_luong_ton=excluded.so_luong_ton`, [sku, quantity]);
      await db.exec('alter table "TON_KHO" enable trigger phub_stock_audit');
    };
    const adjustment = (sku, before, after, at) => db.query(`insert into admin_ops.stock_events
      (warehouse_id,sku,before_quantity,after_quantity,reason,created_at) values(2,$1,$2,$3,'inventory:adjust',$4)`, [sku, before, after, at]);
    let receiptId = 0;
    const receipt = async (sku, quantity, cost, at) => {
      const id = ++receiptId;
      await db.query(`insert into "PHIEU_NHAP"(ma_phieu_nhap,ma_phieu_code,ma_ncc,ma_kho,ngay_tao,ngay_nhap,nguoi_tao,trang_thai)
        values($1,$2,1,2,$3,null,'AD','NHAP')`, [id, `PN${id}`, at]);
      await db.query(`insert into "CT_PHIEU_NHAP"(ma_phieu_nhap,sku,so_luong_nhap,gia_nhap) values($1,$2,$3,$4)`, [id, sku, quantity, cost]);
      await db.query(`update "PHIEU_NHAP" set trang_thai='DA_NHAP',ngay_nhap=$2 where ma_phieu_nhap=$1`, [id, at]);
    };
    const sale = async (id, sku, quantity, dispatched, completed) => {
      await db.query(`insert into "DON_HANG"(ma_donhang,kenh_ban,trang_thai,thoi_gian_dat,thoi_gian_xuat_kho,thoi_gian_hoan_thanh)
        values($1,'ONLINE','HOAN_THANH',$2,$2,$3)`, [id, dispatched, completed]);
      await db.query(`insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien)
        values($1,$2,2,'Product','unit',$3,300,0,0,0,0,$3*300)`, [id, sku, quantity]);
    };
    const product = sku => db.query(`insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi)
      values($1,$1,'Product','L','SC',300,'unit')`, [sku]);

    await product('OLD'); await receipt('OLD', 10, 100, '2026-09-01');
    await sale('OLD-SALE', 'OLD', 2, '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z');
    await stock('OLD', 8); await adjustment('OLD', 0, 8, '2026-10-30T01:06:00Z');
    assert.equal((await report('2026-09-01', '2026-09-30')).cost, '200.00');
    assert.equal((await report()).cost, null, 'reproduce the old wide-period bug');
    const fingerprint = () => scalar(`select jsonb_build_object(
      'stock',(select jsonb_agg(to_jsonb(t)) from "TON_KHO" t),
      'events',(select jsonb_agg(to_jsonb(e) order by id) from admin_ops.stock_events e),
      'receipts',(select jsonb_agg(to_jsonb(p)) from "PHIEU_NHAP" p),
      'orders',(select jsonb_agg(to_jsonb(d)) from "DON_HANG" d)) as r`);
    const before = await fingerprint();
    await migrate('20261030154352_report_stock_adjustment_timeline.sql');
    assert.deepEqual(await fingerprint(), before, 'migration only changes the report function');
    let r = await report();
    assert.equal(r.cost, '200.00'); assert.equal(r.gross_profit, '400.00'); assert.deepEqual(r.warnings, []);
    assert.equal((await report('2026-09-01', '2026-09-30')).cost, r.cost, 'wider range preserves old cost');

    // A real quantity change also must not poison earlier dispatch costs.
    await adjustment('OLD', 8, 9, '2026-10-30T02:00:00Z'); await stock('OLD', 9);
    assert.equal((await report()).cost, '200.00');
    await sale('AFTER-ADJUSTMENT', 'OLD', 1, '2026-10-30T12:00:00Z', '2026-10-30T13:00:00Z');
    await stock('OLD', 8);
    r = await report();
    assert.equal(r.cost, null); assert.equal(r.known_cost, '200.00');
    assert.equal(r.costed_lines, 1); assert.equal(r.total_lines, 2);
    assert.deepEqual(r.warnings, ['INCOMPLETE_COST_HISTORY']);

    // Empty stock followed by a fully priced receipt has a known value again.
    await adjustment('OLD', 8, 0, '2026-10-30T14:00:00Z');
    await receipt('OLD', 4, 200, '2026-10-30T15:00:00Z');
    await sale('AFTER-RESET', 'OLD', 1, '2026-10-30T16:00:00Z', '2026-10-30T16:10:00Z');
    await stock('OLD', 3);
    r = await report(); assert.equal(r.known_cost, '400.00'); assert.equal(r.costed_lines, 2);
    assert.equal(r.products[0].unpriced_lines, 1, 'earlier unknown sale remains unknown');

    // Later completion must still use the cost at dispatch, before adjustment.
    await product('LATE'); await receipt('LATE', 10, 100, '2026-09-01');
    await sale('LATE-COMPLETE', 'LATE', 1, '2026-09-10T10:00:00Z', '2026-10-30T13:00:00Z');
    await adjustment('LATE', 0, 9, '2026-10-30T01:06:00Z'); await stock('LATE', 9);
    r = await report(); assert.equal(r.products.find(p => p.sku === 'LATE').cost, '100.00');

    // A future audit must not invalidate an earlier report even if current stock changed.
    await product('FUTURE'); await receipt('FUTURE', 10, 100, '2026-09-01');
    await sale('FUTURE-SALE', 'FUTURE', 2, '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z');
    await adjustment('FUTURE', 8, 20, '2026-11-01T01:00:00Z'); await stock('FUTURE', 20);
    r = await report(); assert.equal(r.products.find(p => p.sku === 'FUTURE').cost, '200.00');

    // Truly unexplained balances still invalidate valuation.
    await product('UNKNOWN'); await receipt('UNKNOWN', 10, 100, '2026-09-01');
    await sale('UNKNOWN-SALE', 'UNKNOWN', 2, '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z');
    await stock('UNKNOWN', 9); // documents account for 8, with no timed adjustment.
    r = await report(); assert.equal(r.products.find(p => p.sku === 'UNKNOWN').cost, null);
    // Numeric event IDs, rather than string order, decide ties at the same timestamp.
    await db.exec(`select setval(pg_get_serial_sequence('admin_ops.stock_events','id'),8);`);
    await adjustment('UNKNOWN', 9, 7, '2026-10-30T03:00:00Z');
    await adjustment('UNKNOWN', 7, 6, '2026-10-30T03:00:00Z'); await stock('UNKNOWN', 6);
    r = await report(); assert.equal(r.products.find(p => p.sku === 'UNKNOWN').cost, '200.00');
    await db.exec('set role service_role'); assert.equal((await report()).warehouse_id, 2);
    await db.exec('set role anon'); await assert.rejects(() => report(), /permission denied/);
    console.log('PASS: reproduced wide-period regression; upgrade leaves business rows/logs intact; old costs survive later/future quantity adjustments; later unknown costs remain null; zero-stock reset; dispatch/completion timing; unexplained-stock warning; stable audit ordering; service-only access');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

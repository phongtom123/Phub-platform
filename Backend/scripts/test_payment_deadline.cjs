// Isolated database fixtures only. Never reads .env or connects to Supabase.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const migrations = ['001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
  '20261023_customer_support.sql', '20261028132157_admin_operations.sql',
  '20261102071529_customer_demo_payments.sql', '20261102080347_automatic_checkout_invoice.sql',
  '20261102081903_bypass_business_payments.sql', '20261102130239_stock_based_cart_quantity.sql',
  '20261102140733_multi_warehouse_customer_checkout.sql', '20261102145332_checkout_total_warehouse_stock.sql',
  '20261102151044_reserve_stock_after_invoice_or_payment.sql'];
const sqlFile = name => fs.readFileSync(path.join(__dirname, '../migrations', name), 'utf8').replace(/\r\n/g, '\n');

async function run(db, connect) {
  const exec = sql => db.exec ? db.exec(sql) : db.query(sql);
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].r;
  await exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const migration of migrations) await exec(sqlFile(migration));
  await exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(1,'Test','Test');
    insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Test'),('OTHER','Other');
    insert into "NHAN_VIEN"(ma_nhan_vien,ho_ten,loai_nhan_vien) values('AD','Admin','ADMIN');
    insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','AD');
    insert into "LOAI_SP" values('L','Category',1);
    insert into "LOAI_SP_CON" values('SC','Sub','L',1);
    insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Test','L','SC',100,'unit');
    insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'S',1000);
    insert into "CHUONG_TRINH_KHUYEN_MAI"(ten_chuong_trinh,ngay_bat_dau,ngay_ket_thuc,nguoi_tao,ngay_tao)
      values('Test',now()-interval '1 day',now()+interval '10 days','AD',now());
    insert into "VOUCHER"(ma_ctkm,ma_code,loai_giam,gia_tri_giam,ngay_tao) values(1,'TEST','SO_TIEN',1,now());
    -- Match the live historical invoice type as well as test a non-UTC session.
    alter table "HOA_DON" alter column thoi_gian_lap type timestamp using thoi_gian_lap at time zone 'UTC';`);
  const order = async (id, hours = 0, channel = 'ONLINE', state = 'MOI', total = 100) => {
    await db.query(`insert into "DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat)
      values($1,'C',$2,$3,clock_timestamp())`, [id, channel, state]);
    await db.query(`insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,thue_suat,tien_thue,thanh_tien)
      values($1,'S',1,'Test','unit',2,50,0,0,100)`, [id]);
    await db.query(`insert into "HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
      values('HD-'||$1,$1,(clock_timestamp()-$2*interval '1 hour') at time zone 'UTC',$3,0,$3,'AD')`, [id, hours, total]);
  };
  const pay = (id, status = 'THANH_CONG', amount = 1, connection = db) => connection.query(`insert into "THANH_TOAN"
    (ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian) values($1,$2,'THU','TIEN_MAT',$3,clock_timestamp())`, [id, amount, status]);
  const age = id => db.query(`update "HOA_DON" set han_thanh_toan=clock_timestamp()-interval '1 hour' where ma_donhang=$1`, [id]);
  const expire = limit => scalar('select customer_order_private.expire_unpaid_orders($1) as r', [limit ?? 200]);
  const status = id => scalar('select trang_thai as r from "DON_HANG" where ma_donhang=$1', [id]);
  const deadline = id => scalar("select public.customer_payment_deadline_v1('C',$1) as r", [id]);
  await order('LEGACY', 50);
  await exec(sqlFile('20261104071915_unpaid_invoice_deadline_24h.sql'));
  await exec(sqlFile('20261104073822_payment_deadline_read_compatibility.sql'));
  assert.equal(await deadline('LEGACY'), null, 'no backfill of historical invoices');
  await exec("set timezone='Asia/Ho_Chi_Minh'");
  await order('FRESH');
  assert.equal(await scalar(`select extract(epoch from han_thanh_toan-(thoi_gian_lap at time zone 'UTC'))::int as r from "HOA_DON" where ma_donhang='FRESH'`), 86400);
  assert.equal((await deadline('FRESH')).status, 'awaiting_payment');
  assert.equal(await expire(), 0);
  await order('OFFLINE', 50, 'TAI_QUAY'); await order('FREE', 50, 'ONLINE', 'MOI', 0);
  assert.equal(await deadline('OFFLINE'), null); assert.equal(await deadline('FREE'), null);
  for (const id of ['PARTIAL', 'PAID']) { await order(id); await pay(id, 'THANH_CONG', id === 'PAID' ? 100 : 1); await age(id); }
  await order('DISPATCHED', 50, 'ONLINE', 'DA_XUAT_KHO');
  await order('DONE', 50, 'ONLINE', 'HOAN_THANH');
  await order('DUE', 25); await pay('DUE', 'CHO_XU_LY'); await pay('DUE', 'THAT_BAI');
  await db.query(`insert into payment_demo.attempts(customer_id,request_key,order_id,method,amount,line_snapshot) values('C',$1,'DUE','cash',100,'[]')`, [randomUUID()]);
  await exec(`insert into "SU_DUNG_VOUCHER"(ma_voucher,ma_donhang,so_tien_giam,thoi_gian_ap_dung) values(1,'DUE',1,now());`);
  assert.equal((await deadline('DUE')).status, 'processing_expiry');
  await assert.rejects(() => pay('DUE'), /PAYMENT_DEADLINE_EXPIRED/);
  await assert.rejects(() => exec(`update "DON_HANG" set trang_thai='DA_XUAT_KHO' where ma_donhang='DUE'`), /PAYMENT_DEADLINE_EXPIRED/);
  const availableBefore = Number(await scalar("select admin_ops.available(1,'S') as r"));
  assert.equal(await expire(), 1);
  assert.equal(await status('DUE'), 'HUY');
  assert.equal((await deadline('DUE')).status, 'expired');
  assert.equal(await scalar(`select count(*)::int as r from "THANH_TOAN" where ma_donhang='DUE' and trang_thai='THAT_BAI'`), 2);
  assert.equal(await scalar(`select status as r from payment_demo.attempts where order_id='DUE'`), 'failed');
  assert.equal(await scalar(`select trang_thai as r from "SU_DUNG_VOUCHER" where ma_donhang='DUE'`), 'DA_HUY');
  assert.equal(Number(await scalar("select admin_ops.available(1,'S') as r")), availableBefore + 2);
  assert.equal(await scalar(`select so_luong_ton as r from "TON_KHO" where sku='S'`), 1000, 'never alter physical stock');
  await assert.rejects(() => pay('DUE'), /PAYMENT_DEADLINE_EXPIRED/);
  assert.equal(await expire(), 0, 'idempotent runs');
  assert.equal((await deadline('PARTIAL')).status, 'payment_received');
  assert.equal(await status('PAID'), 'MOI'); assert.equal(await status('DISPATCHED'), 'DA_XUAT_KHO');
  await assert.rejects(() => scalar("select public.customer_payment_deadline_v1('OTHER','FRESH') as r"), /ORDER_NOT_FOUND/);
  const read = id => scalar("select public.customer_read_orders_v3('C',$1,1,20,'VND') as r", [id]);
  assert.equal((await scalar("select public.customer_read_orders_v2('C','FRESH',1,20,'VND') as r")).order.payment_deadline, undefined, 'old deployed API contract unchanged');
  assert.equal((await read('FRESH')).order.payment_deadline.status, 'awaiting_payment');
  assert.ok((await read(null)).items.some(item => item.id === 'DUE' && item.payment_deadline.status === 'expired'));
  assert.equal(await scalar("select has_function_privilege('anon','public.customer_payment_deadline_v1(text,text)','execute') as r"), false);
  await order('ROLLBACK', 25);
  await exec(`create function public.reject_expiry_test() returns trigger language plpgsql as $$begin
    if new.ma_donhang='ROLLBACK' then raise exception 'TEST_FAILURE';end if;return new;end $$;
    create trigger reject_expiry_test before update on "HOA_DON" for each row execute function public.reject_expiry_test();`);
  await assert.rejects(() => expire(), /TEST_FAILURE/);
  assert.equal(await status('ROLLBACK'), 'MOI');
  assert.equal((await deadline('ROLLBACK')).expired_at, null);
  await exec('drop trigger reject_expiry_test on "HOA_DON";');
  await order('BATCH', 25);
  assert.equal(await expire(1), 1); assert.equal(await expire(1), 1); assert.equal(await expire(), 0);
  await assert.rejects(() => expire(1001), /INVALID_EXPIRATION_LIMIT/);
  if (connect) {
    const a = await connect(), b = await connect();
    try {
      await order('RACE-PAY');
      await a.query('begin');
      await a.query(`select 1 from "DON_HANG" where ma_donhang='RACE-PAY' for update`);
      await pay('RACE-PAY', 'THANH_CONG', 1, a);
      await a.query(`update "HOA_DON" set han_thanh_toan=clock_timestamp()-interval '1 second' where ma_donhang='RACE-PAY'`);
      assert.equal((await b.query('select customer_order_private.expire_unpaid_orders(200) as r')).rows[0].r, 0, 'locked payment winner skipped');
      await a.query('commit'); assert.equal(await expire(), 0); assert.equal(await status('RACE-PAY'), 'MOI');
      await order('RACE-EXPIRE', 25);
      await a.query('begin');
      await a.query('select customer_order_private.expire_unpaid_orders(200)');
      await b.query("set statement_timeout='5s'");
      const late = assert.rejects(() => pay('RACE-EXPIRE', 'THANH_CONG', 1, b), /PAYMENT_DEADLINE_EXPIRED/);
      await a.query('commit'); await late;
      assert.equal(await status('RACE-EXPIRE'), 'HUY');
      await order('WAIT-CLOCK');
      await exec(`update "HOA_DON" set han_thanh_toan=clock_timestamp()+interval '1 second' where ma_donhang='WAIT-CLOCK'`);
      await a.query('begin'); await a.query(`select 1 from "DON_HANG" where ma_donhang='WAIT-CLOCK' for update`);
      const waiting = assert.rejects(() => pay('WAIT-CLOCK', 'THANH_CONG', 1, b), /PAYMENT_DEADLINE_EXPIRED/);
      await a.query('select pg_sleep(1.1)'); await a.query('commit'); await waiting;
      console.log('PASS: two-session payment/expiry race and clock re-check after row-lock wait');
    } finally { await a.end(); await b.end(); }
  }
  console.log('PASS: 24h UTC, legacy untouched, ownership, expiry, partial/full protections, pending failures, voucher audit, stock release, idempotency, rollback, batching and privileges');
}
module.exports = { run };
if (require.main === module) (async () => {
  const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite(); try { await run(db); } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Isolated PostgreSQL checks; never connects to Supabase or records real payments.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    const migrate = file => db.exec(fs.readFileSync(path.resolve(__dirname, '../migrations', file), 'utf8'));
    const scalar = async (sql, args=[]) => (await db.query(sql, args)).rows[0].r;
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await migrate('001_initial_schema.sql');
    await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(2,'Central','Test');
      insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('AD','ADMIN','Admin');
      insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Customer'),('OTHER','Other');
      insert into "LOAI_SP" values('L','Category',1);
      insert into "LOAI_SP_CON" values('SC','Sub','L',1);
      insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',100,'unit');
      insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(2,'S',50);
      insert into "DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values
        ('A','C','ONLINE','MOI',now()),('B','C','ONLINE','MOI',now()),('REAL','C','ONLINE','XAC_NHAN',now()),('CANCEL','C','ONLINE','HUY',now());
      insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien)
        values('A','S',2,'Product','unit',2,100.05,0.01,0.02,10,0,200.07),('B','S',2,'Product','unit',1,200,0,0,0,0,200);
      insert into "HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
        values('HD-REAL','REAL',now(),10,1,11,'AD');`);
    await migrate('20261102071529_customer_demo_payments.sql');
    await db.exec('set role service_role');
    const command = (order,key,method='bank_transfer',customer='C',action='request',page=1) => scalar(
      'select public.customer_demo_payment_v1($1,$2,$3,$4,$5,$6,1) as r', [customer,order,action,key,method,page]);
    const key = randomUUID();
    assert.equal((await command('A',key,'card','OTHER')).error,'ORDER_NOT_FOUND');
    assert.equal((await command('REAL',randomUUID())).error,'ORDER_NOT_PAYABLE');
    assert.equal((await command('CANCEL',randomUUID())).error,'ORDER_NOT_PAYABLE');
    const result = await command('A',key);
    assert.equal(result.replayed,false);
    assert.equal(result.overview.latest_transaction.amount,'220.08','tax rounded per order line using numeric');
    assert.equal(result.overview.latest_transaction.status,'succeeded');
    assert.equal(result.overview.demo.order_status,'DANG_CHUAN_BI');
    assert.match(result.overview.message,/không thu tiền thật/);
    const recorded = await scalar('select updated_at::text as r from payment_demo.attempts where request_key=$1',[key]);
    assert.equal((await command('A',key)).replayed,true);
    assert.equal(await scalar('select updated_at::text as r from payment_demo.attempts where request_key=$1',[key]),recorded);
    assert.equal((await command('A',key,'card')).error,'IDEMPOTENCY_CONFLICT');
    assert.equal((await command('B',key)).error,'IDEMPOTENCY_CONFLICT');
    assert.equal((await command('A',randomUUID())).error,'ORDER_ALREADY_PAID');
    assert.equal(await scalar('select count(*)::int as r from payment_demo.attempts'),1);
    assert.equal(await scalar('select count(*)::int as r from "THANH_TOAN"'),0);
    assert.equal(await scalar('select count(*)::int as r from "HOA_DON"'),1);
    assert.equal(await scalar('select so_luong_ton as r from "TON_KHO" where ma_kho=2 and sku=\'S\''),50);
    assert.equal((await command('A',null,null,'C','read')).overview.latest_transaction.amount,'220.08');
    assert.equal((await command('A',null,null,'C','history')).history.items.length,1);
    assert.equal((await command('A',null,null,'C','history',2)).history.items.length,0);
    await assert.rejects(()=>db.exec(`update "DON_HANG" set trang_thai='DA_XUAT_KHO' where ma_donhang='A'`),/PAYMENT_DEMO_ORDER/);
    await assert.rejects(()=>db.exec(`insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian)
      values('A',220.08,'THU','THE','THANH_CONG',now())`),/PAYMENT_DEMO_ORDER/);
    await assert.rejects(()=>db.exec(`insert into "HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
      values('HD-A','A',now(),200.07,20.01,220.08,'AD')`),/PAYMENT_DEMO_ORDER/);
    // A failure after creating the simulated transaction must roll back both changes.
    await db.exec(`reset role; create function public.reject_demo_test() returns trigger language plpgsql as $$
      begin if new.ma_donhang='B' and new.trang_thai='DANG_CHUAN_BI' then raise exception 'TEST_FAILURE'; end if;return new;end $$;
      create trigger reject_demo_test before update on "DON_HANG" for each row execute function public.reject_demo_test();set role service_role;`);
    await assert.rejects(()=>command('B',randomUUID()),/TEST_FAILURE/);
    assert.equal(await scalar(`select count(*)::int as r from payment_demo.attempts where order_id='B'`),0);
    assert.equal(await scalar(`select trang_thai as r from "DON_HANG" where ma_donhang='B'`),'MOI');
    // Existing real money flows still work, while demo orders remain cancellable.
    await db.exec(`insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian)
      values('REAL',11,'THU','THE','THANH_CONG',now()); update "DON_HANG" set trang_thai='HUY' where ma_donhang='A';`);
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>command('A',key),/permission denied/);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(()=>command('A',key),/permission denied/);
    console.log('PASS: bypass -> preparing, server amount/rounding, owner checks, idempotency, rollback, private ledger, real-workflow isolation, cancellation, RPC permissions');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

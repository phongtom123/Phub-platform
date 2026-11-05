// Focused PostgreSQL checks in memory. Never connects to Supabase.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    const migrate = file => db.exec(fs.readFileSync(path.resolve(__dirname, '../migrations', file), 'utf8'));
    const scalar = async (sql,args=[]) => (await db.query(sql,args)).rows[0].r;
    const call = (order,key,method='bank_transfer',customer='C',action='request',page=1) => scalar(
      'select public.customer_demo_payment_v1($1,$2,$3,$4,$5,$6,1) as r',[customer,order,action,key,method,page]);
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
    for (const file of ['001_initial_schema.sql','20261023_customer_support.sql','20261028132157_admin_operations.sql']) await migrate(file);
    await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(2,'Central','Test');
      insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('AD','ADMIN','Admin');
      insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Customer'),('OTHER','Other');
      insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh,ma_nhan_vien) values
        ('AC','customer','disabled','C',null),('AA','admin','disabled',null,'AD');
      insert into "LOAI_SP" values('L','Category',1);
      insert into "LOAI_SP_CON" values('SC','Sub','L',1);
      insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',100,'unit');
      insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(2,'S',50);
      insert into "DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values
        ('A','C','ONLINE','MOI',now()),('B','C','ONLINE','MOI',now()),('REAL','C','ONLINE','XAC_NHAN',now()),
        ('CANCEL','C','ONLINE','HUY',now()),('LEGACY','C','ONLINE','MOI',now()),
        ('PENDING','C','ONLINE','MOI',now()),('MISMATCH','C','ONLINE','XAC_NHAN',now());
      insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien) values
        ('A','S',2,'Product','unit',2,100.05,0.01,0.02,10,0,200.07),('B','S',2,'Product','unit',1,200,0,0,0,0,200),
        ('REAL','S',2,'Product','unit',1,10,0,0,10,1,11),('LEGACY','S',2,'Product','unit',1,100,0,0,0,0,100),
        ('PENDING','S',2,'Product','unit',1,100,0,0,0,0,100),('MISMATCH','S',2,'Product','unit',1,100,0,0,0,0,100);
      insert into "HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
        values('HD-REAL','REAL',now(),10,1,11,'AD'),('HD-MISMATCH','MISMATCH',now(),99,0,99,'AD');
      insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian) values
        ('REAL',4,'THU','TIEN_MAT','THANH_CONG',now()),('PENDING',100,'THU','THE','CHO_XU_LY',now());`);
    await migrate('20261102071529_customer_demo_payments.sql');
    const legacyKey = randomUUID();
    await db.exec('set role service_role');
    await call('LEGACY',legacyKey);
    assert.equal(await scalar(`select count(*)::int as r from "THANH_TOAN" where ma_donhang='LEGACY'`),0);
    await db.exec('reset role');
    await migrate('20261102081903_bypass_business_payments.sql');
    await db.exec('set role service_role');
    assert.equal(await scalar(`select count(*)::int as r from "THANH_TOAN" where ma_donhang='LEGACY' and la_bypass`),1,'legacy bypass is posted, not a new order');
    assert.equal(await scalar(`select count(*)::int as r from "HOA_DON" where ma_donhang='LEGACY'`),1);
    assert.equal((await call('LEGACY',legacyKey)).replayed,true,'old key now replays the posted payment');
    const key=randomUUID();
    assert.equal((await call('A',key,'card','OTHER')).error,'ORDER_NOT_FOUND');
    assert.equal((await call('CANCEL',randomUUID())).error,'ORDER_NOT_PAYABLE');
    assert.equal((await call('PENDING',randomUUID())).error,'PAYMENT_ALREADY_PENDING');
    assert.equal((await call('MISMATCH',randomUUID())).error,'INVOICE_TOTAL_MISMATCH');
    const result=await call('A',key);
    assert.equal(result.replayed,false);
    assert.equal(result.overview.latest_transaction.amount,'220.08');
    assert.equal(result.overview.latest_transaction.status,'succeeded');
    assert.equal(result.overview.demo.order_status,'DANG_CHUAN_BI');
    assert.match(result.overview.message,/ghi vào hệ thống/);
    const invoice=await scalar(`select to_jsonb(h) as r from "HOA_DON" h where ma_donhang='A'`);
    assert.equal(invoice.tong_tien_sau_thue,220.08);
    assert.equal(invoice.nguoi_lap,null);
    assert.equal(invoice.nguon_lap,'TU_DONG');
    assert.equal(invoice.ma_tk_lap,'AC','automated invoice does not impersonate an employee');
    assert.equal(await scalar(`select thanh_tien::text as r from "CT_DON_HANG" where ma_donhang='A'`),'220.08');
    assert.equal(await scalar(`select ma_tk_ghi_nhan as r from "THANH_TOAN" where ma_donhang='A'`),'AC');
    const recorded=await scalar('select updated_at::text as r from payment_demo.attempts where request_key=$1',[key]);
    assert.equal((await call('A',key)).replayed,true);
    assert.equal(await scalar('select updated_at::text as r from payment_demo.attempts where request_key=$1',[key]),recorded);
    assert.equal((await call('A',key,'card')).error,'IDEMPOTENCY_CONFLICT');
    assert.equal((await call('B',key)).error,'IDEMPOTENCY_CONFLICT');
    assert.equal((await call('A',randomUUID())).error,'ORDER_ALREADY_PAID');
    assert.equal(await scalar(`select count(*)::int as r from "THANH_TOAN" where ma_donhang='A'`),1);
    assert.equal(await scalar(`select count(*)::int as r from "HOA_DON" where ma_donhang='A'`),1);
    assert.equal(await scalar(`select so_luong_ton as r from "TON_KHO" where ma_kho=2 and sku='S'`),50,'payment does not dispatch stock');
    const partial=await call('REAL',randomUUID(),'card');
    assert.equal(partial.overview.latest_transaction.amount,'7.00','collect only the invoice balance');
    assert.equal(await scalar(`select nguoi_lap as r from "HOA_DON" where ma_donhang='REAL'`),'AD','preserve existing invoice issuer');
    assert.equal((await call('REAL',null,null,'C','history')).history.pagination.total,2);
    assert.equal((await call('REAL',null,null,'C','history',3)).history.items.length,0);
    // An error after the financial inserts must roll back all of them.
    await db.exec(`reset role;create function public.reject_demo_test() returns trigger language plpgsql as $$
      begin if new.ma_donhang='B' and new.trang_thai='DANG_CHUAN_BI' then raise exception 'TEST_FAILURE';end if;return new;end $$;
      create trigger reject_demo_test before update on "DON_HANG" for each row execute function public.reject_demo_test();set role service_role;`);
    await assert.rejects(()=>call('B',randomUUID()),/TEST_FAILURE/);
    assert.equal(await scalar(`select count(*)::int as r from "THANH_TOAN" where ma_donhang='B'`),0);
    assert.equal(await scalar(`select count(*)::int as r from "HOA_DON" where ma_donhang='B'`),0);
    assert.equal(await scalar(`select count(*)::int as r from payment_demo.attempts where order_id='B'`),0);
    assert.equal(await scalar(`select trang_thai as r from "DON_HANG" where ma_donhang='B'`),'MOI');
    const admin=(action,order,body={})=>scalar("select public.admin_operation_v1('AA','orders',$1,$2,$3,$4) as r",[action,randomUUID(),order,body]);
    await admin('dispatch','A');
    assert.equal(await scalar(`select so_luong_ton as r from "TON_KHO" where ma_kho=2 and sku='S'`),48,'normal dispatch works after bypass');
    await admin('complete','A');
    assert.equal(await scalar(`select trang_thai as r from "DON_HANG" where ma_donhang='A'`),'HOAN_THANH');
    await admin('refund','REAL',{amount:'2.00',method:'THE',reference:'REFUND-TEST'});
    assert.equal((await call('REAL',null,null,'C','history')).history.pagination.total,3,'read public payment/refund history');
    assert.equal((await call('REAL',null,null,'C','read')).overview.latest_transaction.type,'refund');
    await db.exec('reset role;set role anon');
    await assert.rejects(()=>call('A',key),/permission denied/);
    await db.exec('reset role;set role authenticated');
    await assert.rejects(()=>call('A',key),/permission denied/);
    console.log('PASS: invoice + collection + preparing, rounding, audit actor, legacy repair, idempotency, partial balance, pending/mismatch checks, rollback, normal dispatch/completion/refund, permissions');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

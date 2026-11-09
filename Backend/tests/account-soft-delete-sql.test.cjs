/** Isolated PostgreSQL fixtures only; never reads credentials or writes live accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
(async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to service_role;
      create table public."NHAN_VIEN"(ma_nhan_vien varchar primary key,loai_nhan_vien text,trang_thai int);
      create table public."TAI_KHOAN"(ma_tk varchar primary key,ten_tai_khoan varchar unique,email varchar unique,
        ma_nhan_vien varchar references public."NHAN_VIEN",ma_kh varchar,trang_thai int not null default 1,
        mat_khau text,ma_media_anh_dai_dien uuid,phien_ban_mat_khau uuid not null default gen_random_uuid());
      create table public.history_fixture(account_id varchar references public."TAI_KHOAN",content text);
      grant select,insert,update on all tables in schema public to service_role;
      insert into public."NHAN_VIEN" values ('NV1','ADMIN',1),('NV2','NHAN_VIEN',1),('NV3','ADMIN',1);
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,ma_nhan_vien,mat_khau) values
        ('AD1','admin','NV1','fixture'),('TK1','staff','NV2','fixture'),('AD2','admin2','NV3','fixture');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,ma_kh,mat_khau) values ('KH1','customer','KH1','fixture');
      insert into public.history_fixture values ('TK1','retain orders, invoices and history');`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20261109065207_account_soft_delete.sql'),'utf8'));
    const account = async () => (await db.query(`select * from public."TAI_KHOAN" where ma_tk='TK1'`)).rows[0];
    const archive = async (archived,id='TK1',actor='AD1') =>
      (await db.query('select public.admin_archive_account_v1($1,$2,$3) result',[id,actor,archived])).rows[0].result;
    const original = await account();
    await db.exec('set role service_role');
    const deleted = await archive(true);
    assert.ok(deleted.luu_tru_luc); assert.equal(deleted.luu_tru_boi,'AD1');
    assert.equal((await account()).trang_thai,0);
    assert.notEqual((await account()).phien_ban_mat_khau,original.phien_ban_mat_khau);
    assert.equal(Object.keys(deleted).sort().join(','),'luu_tru_boi,luu_tru_luc,ma_tk');
    const revision = (await account()).phien_ban_mat_khau;
    assert.deepEqual(await archive(true),deleted,'Retry is idempotent');
    assert.equal((await account()).phien_ban_mat_khau,revision);
    await assert.rejects(db.exec(`update public."TAI_KHOAN" set trang_thai=1 where ma_tk='TK1'`),e=>e.code==='23514');
    await assert.rejects(db.exec(`update public."TAI_KHOAN" set email='bad@test' where ma_tk='TK1'`),e=>e.code==='23514');
    await assert.rejects(archive(true,'AD1'),e=>e.code==='23514');
    await assert.rejects(archive(true,'MISSING'),e=>e.code==='P0002');
    await assert.rejects(archive(true,'KH1','TK1'),e=>e.code==='42501');
    await assert.rejects(archive(null),e=>e.code==='23514');
    const restored = await archive(false);
    assert.equal(restored.luu_tru_luc,null); assert.equal(restored.luu_tru_boi,null);
    assert.equal((await account()).trang_thai,0,'Restore must not enable login');
    await db.exec(`update public."TAI_KHOAN" set trang_thai=1 where ma_tk='TK1'`);
    assert.equal((await account()).phien_ban_mat_khau,revision,'Old sessions never return after reactivation');
    assert.equal((await db.query('select count(*)::int n from public.history_fixture')).rows[0].n,1);
    await archive(true,'AD2');
    await assert.rejects(archive(true,'KH1','AD2'),e=>e.code==='42501');
    await archive(true,'KH1');
    for (const role of ['anon','authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(archive(false),e=>e.code==='42501');
    }
    console.log('Account soft delete SQL: permissions, history, session revocation, idempotency and restore passed.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

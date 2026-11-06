/** In-memory PostgreSQL only. Never reads .env or writes live customer data. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
(async () => {
  const db = await PGlite.create();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    for (const file of ['001_initial_schema.sql', '20261022_crm_customer_profile_interests.sql', '20261023012955_remove_customer_interests.sql']) {
      await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations', file), 'utf8'));
    }
    await db.exec(`alter table public."TAI_KHOAN" add column phien_ban_mat_khau uuid not null default gen_random_uuid();
      insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('NV1','ADMIN','Admin');
      insert into public."KHACH_HANG"(ma_kh,ten_kh,ngay_sinh) values('KH1','Customer','2000-02-29'),('KH2','No account',null);
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('AD1','admin','fixture','NV1');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh) values('TK1','customer','fixture','KH1');
      create table public.soft_delete_history_fixture(customer_id varchar references public."KHACH_HANG"(ma_kh), content text);
      insert into public.soft_delete_history_fixture values('KH1','keep order/invoice history');
      grant select on public.soft_delete_history_fixture to service_role;`);
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261105083031_customer_soft_delete.sql'), 'utf8'));
    const account = async () => (await db.query('select trang_thai,phien_ban_mat_khau from public."TAI_KHOAN" where ma_tk=\'TK1\'')).rows[0];
    const original = await account();
    await db.exec('set role service_role');
    const archive = async (archived, id='KH1', actor='AD1') => (await db.query('select public.admin_archive_customer_v1($1,$2,$3) result',[id,actor,archived])).rows[0].result;
    const first = await archive(true);
    assert.ok(first.profile.luu_tru_luc);
    assert.equal(first.account.trang_thai,0);
    assert.equal(first.profile.ngay_sinh,'2000-02-29');
    assert.ok(!JSON.stringify(first).includes('mat_khau'));
    const deletedAccount = await account();
    assert.notEqual(deletedAccount.phien_ban_mat_khau,original.phien_ban_mat_khau);
    assert.deepEqual(await archive(true),first,'Retry preserves original timestamp and revision');
    assert.deepEqual(await account(),deletedAccount);
    await assert.rejects(db.exec('update public."TAI_KHOAN" set trang_thai=1 where ma_tk=\'TK1\''),e=>e.code==='23514');
    await assert.rejects(db.exec('update public."KHACH_HANG" set ten_kh=\'BAD\' where ma_kh=\'KH1\''),e=>e.code==='23514');
    await assert.rejects(archive(true,'MISSING'),e=>e.code==='P0002');
    await assert.rejects(archive(false,'KH1','TK1'),e=>e.code==='42501');
    const restored = await archive(false);
    assert.equal(restored.profile.luu_tru_luc,null);
    assert.equal(restored.account.trang_thai,0,'Restore never automatically enables login');
    assert.equal((await account()).phien_ban_mat_khau,deletedAccount.phien_ban_mat_khau,'Old session cannot revive after restore');
    assert.equal((await db.query('select count(*)::int n from public.soft_delete_history_fixture')).rows[0].n,1);
    assert.equal((await archive(true,'KH2')).account,null);
    await db.exec('reset role');
    // Fail after updating the profile: the account write must roll the whole RPC back.
    await db.exec(`create function public.soft_delete_fail_account() returns trigger language plpgsql as $$ begin raise exception 'fixture failure' using errcode='23514'; end; $$;
      create trigger soft_delete_fail_account before update on public."TAI_KHOAN" for each row execute function public.soft_delete_fail_account();
      set role service_role;`);
    await assert.rejects(archive(true),e=>e.code==='23514');
    assert.equal((await db.query('select luu_tru_luc from public."KHACH_HANG" where ma_kh=\'KH1\'')).rows[0].luu_tru_luc,null);
    for (const role of ['anon','authenticated']) {
      await db.exec('reset role; set role '+role);
      await assert.rejects(archive(true),e=>e.code==='42501');
    }
    console.log('PASS: archive/restore, retries, session revocation, account/profile guards, history preservation, rollback and role grants in isolated PostgreSQL.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

/** Offline SQL verification of removing interests while retaining profiles/support/warehouses. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function main() {
  const db = await PGlite.create();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(read('Backend/migrations/001_initial_schema.sql'));
    await db.exec(`insert into public."KHACH_HANG" (ma_kh,ten_kh) values ('KH1','Khach');
      insert into public."NHAN_VIEN" (ma_nhan_vien,loai_nhan_vien,ho_ten) values ('NV1','ADMIN','Admin');
      insert into public."TAI_KHOAN" (ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('AD1','admin','!test','NV1');
      insert into public."TAI_KHOAN" (ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh) values ('TK1','khach','!test','KH1');`);
    await db.exec(read('Backend/migrations/20261022_crm_customer_profile_interests.sql'));
    await db.exec(read('Backend/migrations/20261022_crm_admin_profile_api.sql'));
    await db.exec(read('Backend/migrations/20261023_customer_support.sql'));
    await db.exec(`insert into public."KHACH_HANG_SO_THICH" (ma_kh,ma_so_thich) values ('KH1','GAMING');`);
    const before = (await db.query('select * from public."KHACH_HANG"')).rows;
    await db.exec(read('Backend/migrations/20261023012955_remove_customer_interests.sql'));
    assert.deepEqual((await db.query('select * from public."KHACH_HANG"')).rows, before);
    const tables = (await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(r => r.tablename);
    assert.ok(!tables.includes('SO_THICH') && !tables.includes('KHACH_HANG_SO_THICH'));
    for (const name of ['PHAN_HOI','KHO','TON_KHO','PHIEU_CHUYEN_KHO','CT_CHUYEN_KHO']) assert.ok(tables.includes(name));
    assert.equal((await db.query("select to_regprocedure('public.admin_update_customer_crm_v1(text,text,jsonb,text[])') old_rpc")).rows[0].old_rpc, null);
    await db.exec('set role service_role');
    const update = async (changes, actor = 'AD1') => (await db.query(
      "select public.admin_update_customer_profile_v2('KH1',$1,$2::jsonb) result", [actor, JSON.stringify(changes)]
    )).rows[0].result;
    let result = await update({ ten_kh: ' Ten moi ', ngay_sinh: '2000-02-29' });
    assert.equal(result.profile.ten_kh, 'Ten moi');
    assert.equal(result.profile.ngay_sinh, '2000-02-29');
    assert.equal(result.profile.ngay_tao, null);
    assert.ok(result.profile.cap_nhat_luc);
    assert.equal(result.account.ma_tk, 'TK1');
    assert.deepEqual(Object.keys(result).sort(), ['account','profile']);
    assert.ok(!JSON.stringify(result).includes('mat_khau'));
    result = await update({ ngay_sinh: null, sdt: null });
    assert.equal(result.profile.ngay_sinh, null);
    await assert.rejects(update({ ten_kh: 'MUST_ROLL_BACK', ngay_sinh: '2999-01-01' }), e => e.code === '23514');
    assert.equal((await db.query('select ten_kh from public."KHACH_HANG"')).rows[0].ten_kh, 'Ten moi');
    for (const changes of [{}, { ten_kh: ' ' }, { so_thich: [] }, { luu_tru_luc: null }]) await assert.rejects(update(changes), e => e.code === '23514');
    await assert.rejects(update({ ten_kh: 'x' }, 'TK1'), e => e.code === '42501');
    await db.exec('update public."TAI_KHOAN" set trang_thai=2 where ma_tk=\'AD1\'');
    await assert.rejects(update({ ten_kh: 'x' }), e => e.code === '42501');
    for (const role of ['anon','authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(update({ ten_kh: 'x' }), e => e.code === '42501');
    }
    if (process.env.PHUB_INTEREST_RESTORE_SQL) {
      await db.exec('reset role');
      await db.exec(fs.readFileSync(process.env.PHUB_INTEREST_RESTORE_SQL, 'utf8'));
      assert.equal((await db.query('select count(*)::int n from public."SO_THICH"')).rows[0].n, 3);
      console.log('PASS: private backup restore SQL in isolated PostgreSQL.');
    }
    console.log('PASS: remove interest tables/RPC, preserve other tables/data, safe atomic profile update and role grants.');
  } finally { await db.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

/** Isolated PostgreSQL test: no .env, network, Supabase project or real credentials. */
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
    await db.exec(read('Backend/migrations/20261010_admin_account_creation.sql'));
    await db.exec(read('Backend/migrations/20261011080003_customer_self_registration.sql'));
    await db.exec(`insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values ('NV1','ADMIN','Admin');
      insert into public."KHACH_HANG"(ma_kh,ten_kh) values ('KH1','Existing customer');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('AD1','admin','$argon2id$fixture','NV1');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh,trang_thai) values ('KH1','customer','$argon2id$fixture','KH1',2);`);
    const migration = read('Backend/migrations/20261024161801_account_plaintext_passwords.sql');
    await assert.rejects(db.exec(migration), /Explicit confirmation required/);
    await db.exec('rollback');
    assert.equal((await db.query(`select count(*)::int n from information_schema.columns where table_name='TAI_KHOAN' and column_name='mat_khau_hash'`)).rows[0].n, 1);
    await db.exec("set phub.allow_plaintext_password_reset = 'RESET_UNKNOWN_ACCOUNT_PASSWORDS'");
    await assert.rejects(db.exec(migration), /preservation input required/);
    await db.exec('rollback');
    const marker = '-- PHUB_LOCAL_PASSWORD_INPUT: generated locally; never commit real credentials.';
    const knownInput = `insert into pg_temp.phub_password_preservation values ('AD1','known-admin-password','$argon2id$fixture');`;
    const staleInput = knownInput.replace('$argon2id$fixture', '$argon2id$stale');
    await assert.rejects(db.exec(migration.replace(marker, marker + '\n' + staleInput)), /stale password preservation input/);
    await db.exec('rollback');
    await db.exec(migration.replace(marker, marker + '\n' + knownInput));
    const rows = (await db.query('select ma_tk,trang_thai,mat_khau from public."TAI_KHOAN" order by ma_tk')).rows;
    assert.equal(rows.length, 2); assert.equal(rows[1].trang_thai, 2);
    assert.equal(new Set(rows.map(row => row.mat_khau)).size, 2);
    assert.equal(rows[0].mat_khau, 'known-admin-password');
    assert.ok(rows[1].mat_khau.startsWith('Reset-') && rows[1].mat_khau.length >= 10);
    assert.equal((await db.query(`select count(*)::int n from information_schema.columns where table_name='TAI_KHOAN' and column_name='mat_khau_hash'`)).rows[0].n, 0);
    assert.equal((await db.query(`select count(*)::int n from pg_proc where proname in ('admin_create_account_v1','customer_register_v1')`)).rows[0].n, 0);
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select public.set_account_password_v2($1,$2,$3)', ['AD1','new-test-password',null]), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const create = await db.query('select public.admin_create_account_v2($1,$2,$3,$4,$5,$6,$7,$8) result', ['AD1','new.customer',null,'  Unicode-đơn-123  ','KH_NEW','New customer','KHACH_HANG',null]);
    assert.equal(create.rows[0].result.role, 'KHACH_HANG');
    assert.ok(!JSON.stringify(create.rows).includes('Unicode-đơn-123'));
    assert.equal((await db.query('select mat_khau from public."TAI_KHOAN" where ma_kh=$1', ['KH_NEW'])).rows[0].mat_khau, '  Unicode-đơn-123  ');
    await db.query('select public.customer_register_v2($1,$2,$3,$4,$5,$6)', ['self.customer','self@example.test','self-test-password','KH_SELF','Self customer',null]);
    assert.equal((await db.query('select mat_khau from public."TAI_KHOAN" where ma_kh=$1', ['KH_SELF'])).rows[0].mat_khau, 'self-test-password');
    const change = async (expected, value) => (await db.query('select public.set_account_password_v2($1,$2,$3) result', ['AD1',value,expected])).rows[0].result;
    assert.deepEqual(await change('wrong-password','replacement-password'), []);
    assert.deepEqual(await change(rows[0].mat_khau,'replacement-password'), [{ ma_tk: 'AD1' }]);
    assert.deepEqual(await change(rows[0].mat_khau,'must-not-overwrite'), []);
    assert.deepEqual(await change(null,'admin-reset-password'), [{ ma_tk: 'AD1' }]);
    await assert.rejects(change(null,'short'), error => error.code === '23514');
    assert.equal((await db.query('select mat_khau from public."TAI_KHOAN" where ma_tk=$1', ['AD1'])).rows[0].mat_khau, 'admin-reset-password');
    const revision = (await db.query('select phien_ban_mat_khau from public."TAI_KHOAN" where ma_tk=$1', ['AD1'])).rows[0].phien_ban_mat_khau;
    await change(null,'admin-reset-password');
    assert.notEqual((await db.query('select phien_ban_mat_khau from public."TAI_KHOAN" where ma_tk=$1', ['AD1'])).rows[0].phien_ban_mat_khau, revision);
    assert.deepEqual((await db.query('select public.set_account_password_v2($1,$2,$3,$4) result', ['AD1','other-password','admin-reset-password',revision])).rows[0].result, []);
    console.log('PASS: migration guard, reset, preserved identities/statuses, plaintext RPCs, permissions and conditional password replacement.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

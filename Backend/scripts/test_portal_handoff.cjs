// Isolated PostgreSQL test. Never accepts a cloud database URL.
// PHUB_PG_MODULE=/path/to/pg node Backend/scripts/test_portal_handoff.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { Client } = require(process.env.PHUB_PG_MODULE || 'pg');
const config = { host: '127.0.0.1', port: Number(process.env.PHUB_TEST_PG_PORT || 55432), user: 'postgres' };
const database = 'phub_handoff_test_' + randomUUID().replaceAll('-', '');
const admin = new Client({ ...config, database: 'postgres' });
const source = 'https://admin.example.test', target = 'https://warehouse.example.test';
const version = 'b'.repeat(64);
let db, contenders = [];
async function main() {
  await admin.connect();
  for (const role of ['anon', 'authenticated', 'service_role']) {
    if (!(await admin.query('select 1 from pg_roles where rolname=$1', [role])).rowCount)
      await admin.query(`create role ${role} ${role === 'service_role' ? 'bypassrls' : ''}`);
  }
  await admin.query(`create database ${database}`);
  db = new Client({ ...config, database });
  await db.connect();
  await db.query(`create table public."NHAN_VIEN" (ma_nhan_vien text primary key, loai_nhan_vien text, trang_thai int, ma_kho int);
    create table public."TAI_KHOAN" (ma_tk text primary key, ma_nhan_vien text references public."NHAN_VIEN", trang_thai int);
    insert into public."NHAN_VIEN" values ('NV1','NHAN_VIEN',1,1);
    insert into public."TAI_KHOAN" values ('STAFF1','NV1',1);
    grant select, update on public."NHAN_VIEN",public."TAI_KHOAN" to service_role;`);
  await db.query(fs.readFileSync(path.join(__dirname, '../migrations/20261029155128_staff_portal_handoff.sql'), 'utf8'));
  const schema = await db.query(`select relrowsecurity from pg_class where oid='portal_auth.handoffs'::regclass`);
  assert.equal(schema.rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    const rights = (await db.query(`select has_schema_privilege($1,'portal_auth','USAGE') as schema,
      has_table_privilege($1,'portal_auth.handoffs','SELECT,INSERT,DELETE') as table_access,
      has_function_privilege($1,'public.auth_consume_portal_handoff_v1(text,text,text,text)','EXECUTE') as consume,
      has_function_privilege($1,'public.auth_create_portal_handoff_v1(text,text,text,text,text,text)','EXECUTE') as create_code`, [role])).rows[0];
    assert.deepEqual(rights, { schema: false, table_access: false, consume: false, create_code: false });
  }
  await db.query('set role service_role');
  async function issue() {
    const code = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(code).digest('hex');
    assert.equal((await db.query('select public.auth_create_portal_handoff_v1($1,$2,$3,$4,$5,$6) as ok', ['STAFF1',hash,version,source,target,'NHAN_VIEN'])).rows[0].ok, true);
    return { code, hash };
  }
  const consume = async (hash, from=source, to=target, role='NHAN_VIEN', connection=db) =>
    (await connection.query('select public.auth_consume_portal_handoff_v1($1,$2,$3,$4) as result', [hash,from,to,role])).rows[0].result;
  const first = await issue();
  const stored = (await db.query('select * from portal_auth.handoffs')).rows[0];
  assert.equal(JSON.stringify(stored).includes(first.code), false);
  assert.equal((stored.expires_at-stored.created_at)/1000, 60);
  for (const args of [[target,target,'NHAN_VIEN'],[source,source,'NHAN_VIEN'],[source,target,'ADMIN']])
    assert.equal(await consume(first.hash,...args), null);
  assert.deepEqual(await consume(first.hash), { account_id: 'STAFF1', credential_version: version });
  assert.equal(await consume(first.hash), null, 'a consumed code cannot be replayed');
  const expired = await issue();
  await db.query('reset role');
  await db.query(`update portal_auth.handoffs set expires_at=statement_timestamp()-interval '1 second' where code_hash=$1`, [expired.hash]);
  await db.query('set role service_role');
  assert.equal(await consume(expired.hash), null);
  const parallel = await issue();
  assert.equal((await db.query('select count(*) from portal_auth.handoffs where code_hash=$1', [expired.hash])).rows[0].count, '0');
  contenders = Array.from({length: 8}, () => new Client({ ...config, database }));
  await Promise.all(contenders.map(async connection => { await connection.connect(); await connection.query('set role service_role'); }));
  const results = await Promise.all(contenders.map(connection => consume(parallel.hash,source,target,'NHAN_VIEN',connection)));
  assert.equal(results.filter(Boolean).length, 1, 'exactly one concurrent exchange succeeds');
  await db.query('reset role');
  await db.query('update public."TAI_KHOAN" set trang_thai=0');
  await db.query('set role service_role');
  await assert.rejects(issue, error => error.code === 'PT401');
  console.log('PASS: PostgreSQL migration, private ACL/RLS, 60-second expiry, origin/role binding, replay rejection, 8 concurrent exchanges, disabled account.');
}
main().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => {
  await Promise.all(contenders.map(connection => connection.end().catch(()=>{})));
  await db?.end().catch(()=>{});
  await admin.query(`drop database if exists ${database} with (force)`).catch(()=>{});
  await admin.end().catch(()=>{});
});

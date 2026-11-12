/** Isolated PostgreSQL test: no .env, network, Supabase project or real credentials.
 * Self-registration attaches unowned walk-in counter orders bought with the same email. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

async function database({ orderEmail, invoiceEmail }) {
  const db = await PGlite.create();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
  await db.exec(read('Backend/migrations/001_initial_schema.sql'));
  await db.exec(read('Backend/migrations/20261010_admin_account_creation.sql'));
  await db.exec(read('Backend/migrations/20261011080003_customer_self_registration.sql'));
  await db.exec(`insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values ('NV1','ADMIN','Staff');
    insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('NV1','staff','$argon2id$fixture','NV1');`);
  await db.exec("set phub.allow_plaintext_password_reset = 'RESET_UNKNOWN_ACCOUNT_PASSWORDS'");
  const marker = '-- PHUB_LOCAL_PASSWORD_INPUT: generated locally; never commit real credentials.';
  await db.exec(read('Backend/migrations/20261024161801_account_plaintext_passwords.sql').replace(marker,
    marker + `\ninsert into pg_temp.phub_password_preservation values ('NV1','staff-password-fixture','$argon2id$fixture');`));
  if (orderEmail) await db.exec('alter table public."DON_HANG" add column email_nguoi_mua varchar(254);');
  if (invoiceEmail) await db.exec('alter table public."HOA_DON" add column email_nguoi_mua varchar(254);');
  await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh) values ('KH_OLD','Other customer');`);
  const orders = [
    // id, owner, channel, status, order email, invoice email
    ['DH_COUNTER', null, 'TAI_QUAY', 'HOAN_THANH', 'Buyer@Example.com', null],
    ['DH_INVOICE', null, 'TAI_QUAY', 'DA_XUAT_KHO', null, ' buyer@example.com '],
    ['DH_OTHER', null, 'TAI_QUAY', 'HOAN_THANH', 'someone@example.com', 'someone@example.com'],
    ['DH_CANCEL', null, 'TAI_QUAY', 'HUY', 'buyer@example.com', null],
    ['DH_OWNED', 'KH_OLD', 'TAI_QUAY', 'HOAN_THANH', 'buyer@example.com', null],
    ['DH_ONLINE', null, 'ONLINE', 'MOI', 'buyer@example.com', null],
  ];
  for (const [id, owner, channel, status, email, invoice] of orders) {
    await db.query(`insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values ($1,$2,$3,$4,now())`,
      [id, owner, channel, status]);
    if (orderEmail && email) await db.query('update public."DON_HANG" set email_nguoi_mua=$2 where ma_donhang=$1', [id, email]);
    await db.query(`insert into public."HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
      values ($1,$2,now(),100,10,110,'NV1')`, ['HD_' + id, id]);
    if (invoiceEmail && invoice) await db.query('update public."HOA_DON" set email_nguoi_mua=$2 where ma_donhang=$1', [id, invoice]);
  }
  const migration = read('Backend/migrations/20261112140000_register_links_counter_orders.sql');
  await db.exec(migration);
  await db.exec(migration); // idempotent
  await db.exec('set role service_role');
  return db;
}

const register = async (db, username, email, id) => (await db.query(
  'select public.customer_register_v2($1,$2,$3,$4,$5,$6) result', [username, email, 'buyer-password-1', id, 'Buyer', null])).rows[0].result;
const owners = async db => Object.fromEntries((await db.query('select ma_donhang,ma_kh from public."DON_HANG" order by 1')).rows
  .map(row => [row.ma_donhang, row.ma_kh]));

async function main() {
  let db = await database({ orderEmail: true, invoiceEmail: true });
  try {
    const result = await register(db, 'buyer', 'BUYER@example.com', 'KH_NEW');
    assert.equal(result.role, 'KHACH_HANG');
    assert.equal(result.linked_orders, 2);
    assert.deepEqual(await owners(db), {
      DH_CANCEL: null, DH_COUNTER: 'KH_NEW', DH_INVOICE: 'KH_NEW', DH_ONLINE: null, DH_OTHER: null, DH_OWNED: 'KH_OLD',
    });
    const second = await register(db, 'someone', 'someone@example.com', 'KH_SOMEONE');
    assert.equal(second.linked_orders, 1);
    assert.equal((await owners(db)).DH_OTHER, 'KH_SOMEONE');
    const nothing = await register(db, 'nobody', 'nobody@example.com', 'KH_NOBODY');
    assert.equal(nothing.linked_orders, 0);
    await assert.rejects(register(db, 'buyer2', 'buyer@example.com', 'KH_DUP'), error => error.code === '23505');
    assert.equal((await owners(db)).DH_COUNTER, 'KH_NEW', 'A failed registration must not move orders');
  } finally { await db.close(); }

  db = await database({ orderEmail: false, invoiceEmail: false });
  try {
    const result = await register(db, 'buyer', 'buyer@example.com', 'KH_NEW');
    assert.equal(result.linked_orders, 0, 'Databases without buyer-email columns still register');
    assert.ok(Object.values(await owners(db)).every(owner => owner === null || owner === 'KH_OLD'));
  } finally { await db.close(); }

  db = await database({ orderEmail: false, invoiceEmail: true });
  try {
    assert.equal((await register(db, 'buyer', 'buyer@example.com', 'KH_NEW')).linked_orders, 1);
    assert.equal((await owners(db)).DH_INVOICE, 'KH_NEW');
  } finally { await db.close(); }
  console.log('PASS: registration links unowned counter orders by order or invoice email; skips other, cancelled, owned and online orders; works without email columns; idempotent migration.');
}
main().catch(error => { console.error(error); process.exit(1); });

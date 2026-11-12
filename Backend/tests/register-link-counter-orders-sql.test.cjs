/** Isolated PostgreSQL test: no .env, network, Supabase project or real credentials.
 * Walk-in counter orders are attached to the customer account with the same email:
 * at sale time (existing account), at registration (new account) and once for existing orders. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const MIGRATION = 'Backend/migrations/20261112140000_register_links_counter_orders.sql';

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
  await db.exec('alter table public."KHACH_HANG" add column if not exists luu_tru_luc timestamptz;');
  if (orderEmail) await db.exec('alter table public."DON_HANG" add column email_nguoi_mua varchar(254);');
  if (invoiceEmail) await db.exec('alter table public."HOA_DON" add column email_nguoi_mua varchar(254);');
  await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh,luu_tru_luc) values
      ('KH_OLD','Other customer',null),('KH_ACTIVE','Active',null),('KH_LOCKED','Locked',null),('KH_ARCH','Deleted',now());
    insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,email,mat_khau,ma_kh,trang_thai) values
      ('TK_ACTIVE','active','active@example.com','fixture-password','KH_ACTIVE',1),
      ('TK_LOCKED','locked','locked@example.com','fixture-password','KH_LOCKED',2),
      ('TK_ARCH','deleted','arch@example.com','fixture-password','KH_ARCH',1);`);
  return db;
}

async function order(db, opts, id, owner, channel, status, email, invoice) {
  await db.query(`insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values ($1,$2,$3,$4,now())`,
    [id, owner, channel, status]);
  if (opts.orderEmail && email) await db.query('update public."DON_HANG" set email_nguoi_mua=$2 where ma_donhang=$1', [id, email]);
  await db.query(`insert into public."HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
    values ($1,$2,now(),100,10,110,'NV1')`, ['HD_' + id, id]);
  if (opts.invoiceEmail && invoice) await db.query('update public."HOA_DON" set email_nguoi_mua=$2 where ma_donhang=$1', [id, invoice]);
}

const register = async (db, username, email, id) => (await db.query(
  'select public.customer_register_v2($1,$2,$3,$4,$5,$6) result', [username, email, 'buyer-password-1', id, 'Buyer', null])).rows[0].result;
const owner = async (db, id) => (await db.query('select ma_kh from public."DON_HANG" where ma_donhang=$1', [id])).rows[0].ma_kh;

async function main() {
  const full = { orderEmail: true, invoiceEmail: true };
  let db = await database(full);
  try {
    // Orders that already exist when the migration runs.
    for (const row of [
      ['DH_BF_ACTIVE', null, 'TAI_QUAY', 'HOAN_THANH', 'Active@Example.com ', null],
      ['DH_BF_INVOICE', null, 'TAI_QUAY', 'DA_XUAT_KHO', null, 'active@example.com'],
      ['DH_BF_LOCKED', null, 'TAI_QUAY', 'MOI', 'locked@example.com', null],
      ['DH_BF_ARCH', null, 'TAI_QUAY', 'MOI', 'arch@example.com', null],
      ['DH_BF_CANCEL', null, 'TAI_QUAY', 'HUY', 'active@example.com', null],
      ['DH_BF_ONLINE', null, 'ONLINE', 'MOI', 'active@example.com', null],
      ['DH_BUYER_COUNTER', null, 'TAI_QUAY', 'HOAN_THANH', 'Buyer@Example.com', null],
      ['DH_BUYER_INVOICE', null, 'TAI_QUAY', 'DA_XUAT_KHO', null, ' buyer@example.com '],
      ['DH_OTHER', null, 'TAI_QUAY', 'HOAN_THANH', 'someone@example.com', 'someone@example.com'],
      ['DH_OWNED', 'KH_OLD', 'TAI_QUAY', 'HOAN_THANH', 'buyer@example.com', null],
    ]) await order(db, full, ...row);
    await db.exec(read(MIGRATION));
    await db.exec(read(MIGRATION)); // idempotent
    // 3. Backfill: only unowned, non-cancelled counter orders of active accounts.
    assert.equal(await owner(db, 'DH_BF_ACTIVE'), 'KH_ACTIVE');
    assert.equal(await owner(db, 'DH_BF_INVOICE'), 'KH_ACTIVE');
    for (const id of ['DH_BF_LOCKED', 'DH_BF_ARCH', 'DH_BF_CANCEL', 'DH_BF_ONLINE', 'DH_BUYER_COUNTER', 'DH_OTHER']) {
      assert.equal(await owner(db, id), null, `${id} must stay unowned`);
    }
    assert.equal(await owner(db, 'DH_OWNED'), 'KH_OLD');

    await db.exec('set role service_role');
    // 1. Sale time: an order or invoice with the email of an active account is linked at once.
    await order(db, full, 'DH_NEW_COUNTER', null, 'TAI_QUAY', 'MOI', ' ACTIVE@example.com', null);
    await order(db, full, 'DH_NEW_INVOICE', null, 'TAI_QUAY', 'DA_XUAT_KHO', null, 'Active@example.com');
    await order(db, full, 'DH_NEW_ONLINE', null, 'ONLINE', 'MOI', 'active@example.com', null);
    await order(db, full, 'DH_NEW_OWNED', 'KH_OLD', 'TAI_QUAY', 'MOI', 'active@example.com', null);
    await order(db, full, 'DH_NEW_LOCKED', null, 'TAI_QUAY', 'MOI', 'locked@example.com', null);
    assert.equal(await owner(db, 'DH_NEW_COUNTER'), 'KH_ACTIVE');
    assert.equal(await owner(db, 'DH_NEW_INVOICE'), 'KH_ACTIVE');
    assert.equal(await owner(db, 'DH_NEW_ONLINE'), null);
    assert.equal(await owner(db, 'DH_NEW_OWNED'), 'KH_OLD');
    assert.equal(await owner(db, 'DH_NEW_LOCKED'), null);

    // 2. Registration later: unowned orders bought with the new email.
    const result = await register(db, 'buyer', 'BUYER@example.com', 'KH_NEW');
    assert.equal(result.role, 'KHACH_HANG');
    assert.equal(result.linked_orders, 2);
    assert.equal(await owner(db, 'DH_BUYER_COUNTER'), 'KH_NEW');
    assert.equal(await owner(db, 'DH_BUYER_INVOICE'), 'KH_NEW');
    assert.equal(await owner(db, 'DH_OWNED'), 'KH_OLD');
    assert.equal((await register(db, 'someone', 'someone@example.com', 'KH_SOMEONE')).linked_orders, 1);
    assert.equal((await register(db, 'nobody', 'nobody@example.com', 'KH_NOBODY')).linked_orders, 0);
    await assert.rejects(register(db, 'buyer2', 'buyer@example.com', 'KH_DUP'), error => error.code === '23505');
    assert.equal(await owner(db, 'DH_BUYER_COUNTER'), 'KH_NEW', 'A failed registration must not move orders');
    // The new account now receives later counter sales immediately.
    await order(db, full, 'DH_AFTER_SIGNUP', null, 'TAI_QUAY', 'MOI', 'buyer@example.com', null);
    assert.equal(await owner(db, 'DH_AFTER_SIGNUP'), 'KH_NEW');
  } finally { await db.close(); }

  const bare = { orderEmail: false, invoiceEmail: false };
  db = await database(bare);
  try {
    await order(db, bare, 'DH_PLAIN', null, 'TAI_QUAY', 'MOI', null, null);
    await db.exec(read(MIGRATION));
    await db.exec('set role service_role');
    assert.equal((await register(db, 'buyer', 'buyer@example.com', 'KH_NEW')).linked_orders, 0,
      'Databases without buyer-email columns still register');
    assert.equal(await owner(db, 'DH_PLAIN'), null);
  } finally { await db.close(); }

  const invoiceOnly = { orderEmail: false, invoiceEmail: true };
  db = await database(invoiceOnly);
  try {
    await order(db, invoiceOnly, 'DH_INVOICE', null, 'TAI_QUAY', 'DA_XUAT_KHO', null, 'buyer@example.com');
    await db.exec(read(MIGRATION));
    await db.exec('set role service_role');
    assert.equal((await register(db, 'buyer', 'buyer@example.com', 'KH_NEW')).linked_orders, 1);
    assert.equal(await owner(db, 'DH_INVOICE'), 'KH_NEW');
    await order(db, invoiceOnly, 'DH_INVOICE_LATER', null, 'TAI_QUAY', 'DA_XUAT_KHO', null, 'BUYER@example.com');
    assert.equal(await owner(db, 'DH_INVOICE_LATER'), 'KH_NEW');
  } finally { await db.close(); }
  console.log('PASS: walk-in orders link by email at sale time, at registration and once for existing orders; locked, deleted, online, cancelled and owned orders untouched; works without email columns; idempotent migration.');
}
main().catch(error => { console.error(error); process.exit(1); });

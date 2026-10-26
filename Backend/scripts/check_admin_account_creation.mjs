// Isolated, in-memory PostgreSQL tests. Never accepts a Supabase/database URL.
// Install @electric-sql/pglite outside the repo and set PHUB_PGLITE_MODULE
// to its dist/index.js file URL, or make the package resolvable locally.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { PGlite } = await import(process.env.PHUB_PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
let checks = 0;
const pass = message => { checks++; console.log("PASS:", message); };
const defaults = { actor: "ACTOR", username: "new.user", email: null,
  hash: "$argon2id$test-fixture", owner: "NV_NEW", name: "New Person", role: "ADMIN", warehouse: null };
async function rpc(overrides = {}) {
  const data = { ...defaults, ...overrides };
  const args = [data.actor, data.username, data.email, data.hash, data.owner, data.name, data.role, data.warehouse];
  const result = await db.query("select public.admin_create_account_v1($1,$2,$3,$4,$5,$6,$7,$8::integer) as account", args);
  return result.rows[0].account;
}
async function counts() {
  return (await db.query(`select (select count(*)::int from public."TAI_KHOAN") as accounts,
    (select count(*)::int from public."NHAN_VIEN") as employees,
    (select count(*)::int from public."KHACH_HANG") as customers`)).rows[0];
}
async function failsWithoutWrites(overrides, code, message) {
  const before = await counts();
  await assert.rejects(rpc(overrides), error => error.code === code);
  assert.deepEqual(await counts(), before);
  pass(message);
}

try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../../database/migrations/001_initial_schema.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../migrations/20261010_admin_account_creation.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration);
  pass("additive migration can be reapplied");
  await db.exec(`insert into public."KHO" (ma_kho,ten_kho,dia_chi,trang_thai) values (-900003,'Test warehouse','Test',1),(8,'Inactive','Test',0);
    insert into public."NHAN_VIEN" (ma_nhan_vien,loai_nhan_vien,ho_ten,trang_thai) values ('NV_ACTOR','ADMIN','Admin test',1);
    insert into public."TAI_KHOAN" (ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('ACTOR','admin.test','$argon2id$test-fixture','NV_ACTOR');
    set role service_role;`);

  const employee = await rpc({ email: "new@example.test" });
  assert.equal(employee.ma_tk, "AD000001");
  assert.equal(employee.ma_nhan_vien, "NV_NEW");
  assert.equal(employee.role, "ADMIN");
  assert.equal(employee.ma_kh, null);
  assert.equal(employee.ma_kho, null);
  assert.equal(employee.ho_ten, "New Person");
  assert.equal(employee.owner_active, true);
  assert.equal("mat_khau_hash" in employee, false);
  assert.deepEqual(await counts(), { accounts: 2, employees: 2, customers: 0 });
  pass("creates new admin employee and account atomically, returning no hash");

  const customer = await rpc({ username: "new.customer", owner: "KH_NEW", role: "KHACH_HANG" });
  assert.equal(customer.ma_tk, "KH000001");
  assert.equal(customer.ma_kh, "KH_NEW");
  assert.equal(customer.ma_nhan_vien, null);
  assert.equal(customer.role, "KHACH_HANG");
  pass("creates a new customer without an existing profile");

  const warehouse = await rpc({ username: "new.warehouse", owner: "NV_WAREHOUSE", role: "THU_KHO", warehouse: -900003 });
  assert.equal(warehouse.ma_tk, "KHO000001");
  assert.equal(warehouse.ma_kho, -900003);
  assert.equal(warehouse.role, "THU_KHO");
  pass("new warehouse employee can be assigned a negative warehouse ID");

  pass("separate role prefixes each begin with six-digit account numbers");

  // A manually assigned existing code must be preserved and skipped by nextval.
  await db.exec(`insert into public."NHAN_VIEN" (ma_nhan_vien,loai_nhan_vien,ho_ten) values ('NV_RESERVED','ADMIN','Existing person');
    insert into public."TAI_KHOAN" (ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('AD000002','existing.manual','$argon2id$test-fixture','NV_RESERVED');`);
  const skipped = await rpc({ username: "after.reserved", owner: "NV_AFTER_RESERVED" });
  assert.equal(skipped.ma_tk, "AD000003");
  assert.equal((await db.query(`select ten_tai_khoan from public."TAI_KHOAN" where ma_tk='AD000002'`)).rows[0].ten_tai_khoan, "existing.manual");
  pass("existing manually assigned codes are preserved and skipped");

  const batch = await Promise.all(Array.from({ length: 12 }, (_, index) => rpc({
    username: "batch.customer." + index, owner: "KH_BATCH_" + index, role: "KHACH_HANG",
  })));
  assert.equal(new Set(batch.map(row => row.ma_tk)).size, batch.length);
  assert.ok(batch.every(row => /^KH\d{6}$/.test(row.ma_tk)));
  pass("overlapping creation requests receive distinct generated codes");
  await db.exec("reset role;");
  await db.exec(migration);
  await db.exec("set role service_role;");
  assert.equal((await rpc({ username: "after.migration", owner: "NV_AFTER_MIGRATION" })).ma_tk, "AD000004");
  pass("reapplying the migration does not reset account numbering");

  const beforeFailures = await counts();
  await failsWithoutWrites({ owner: "NV_DUP_USER" }, "23505", "duplicate username rolls back the employee insert");
  await failsWithoutWrites({ username: "duplicate.email", email: "new@example.test", owner: "KH_DUP_EMAIL", role: "KHACH_HANG" }, "23505", "duplicate email rolls back the customer insert");
  await failsWithoutWrites({ username: "inactive.warehouse", owner: "NV_INACTIVE", role: "THU_KHO", warehouse: 8 }, "23514", "inactive warehouse leaves no records");
  await failsWithoutWrites({ username: "missing.warehouse", owner: "NV_MISSING", role: "THU_KHO", warehouse: 999 }, "23514", "missing warehouse leaves no records");
  await failsWithoutWrites({ role: "THU_KHO" }, "23514", "warehouse role requires a warehouse");
  await failsWithoutWrites({ warehouse: -900003 }, "23514", "admin role cannot be assigned a warehouse");
  await failsWithoutWrites({ role: "ROOT" }, "23514", "unknown role cannot create records");
  await failsWithoutWrites({ name: "   " }, "23514", "blank name cannot create records");
  await failsWithoutWrites({ hash: "plaintext-is-not-a-hash" }, "23514", "plaintext password cannot be stored through RPC");
  await failsWithoutWrites({ actor: customer.ma_tk }, "42501", "customer actor cannot create accounts");
  await db.exec(`update public."TAI_KHOAN" set trang_thai=2 where ma_tk='ACTOR';`);
  await failsWithoutWrites({}, "42501", "locked admin actor is rechecked inside the transaction");
  await db.exec(`update public."TAI_KHOAN" set trang_thai=1 where ma_tk='ACTOR'; update public."NHAN_VIEN" set trang_thai=0 where ma_nhan_vien='NV_ACTOR';`);
  await failsWithoutWrites({}, "42501", "inactive admin employee cannot create accounts");
  await db.exec(`update public."NHAN_VIEN" set trang_thai=1 where ma_nhan_vien='NV_ACTOR';`);
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role; set role " + role);
    await assert.rejects(rpc(), error => error.code === "42501");
    pass(role + " cannot execute the privileged function");
  }
  await db.exec("reset role;");
  assert.deepEqual(await counts(), beforeFailures);
  pass("failure cases leave no orphan profiles or accounts");

  await db.query("select setval('admin_account_private.admin_account_ids',999999,true)");
  await db.exec("set role service_role;");
  assert.equal((await rpc({ username: "large.number", owner: "NV_LARGE_NUMBER" })).ma_tk, "AD1000000");
  pass("numbers beyond six digits are not truncated");
  console.log(`PASS: ${checks} isolated PostgreSQL checks; no cloud writes.`);
} finally {
  await db.close();
}

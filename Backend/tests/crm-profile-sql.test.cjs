/** Isolated in-memory PostgreSQL tests. No network, .env or live Supabase connection. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || "@electric-sql/pglite");
const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

async function main() {
  const db = await PGlite.create();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
    await db.exec(read("Backend/migrations/001_initial_schema.sql"));
    await db.exec(`insert into public."KHACH_HANG" (ma_kh, ten_kh) values ('KH1', 'Khach cu');
      insert into public."NHAN_VIEN" (ma_nhan_vien, loai_nhan_vien, ho_ten) values ('NV1', 'ADMIN', 'Admin');
      insert into public."TAI_KHOAN" (ma_tk, ten_tai_khoan, mat_khau_hash, ma_nhan_vien) values ('AD1', 'admin', '!test-only', 'NV1');
      insert into public."TAI_KHOAN" (ma_tk, ten_tai_khoan, mat_khau_hash, ma_kh) values ('TK1', 'customer', '!test-only', 'KH1');`);
    await db.exec(read("Backend/migrations/20261022_crm_customer_profile_interests.sql"));
    await db.exec(read("Backend/migrations/20261022_crm_admin_profile_api.sql"));
    const original = (await db.query('select * from public."KHACH_HANG" where ma_kh=$1', ["KH1"])).rows[0];
    assert.equal(original.ngay_tao, null);
    assert.equal(original.ngay_sinh, null);
    assert.equal((await db.query('select count(*)::int n from public."SO_THICH"')).rows[0].n, 3);

    await db.exec("set role service_role");
    const update = async (changes, interests, actor = "AD1") => (await db.query(
      "select public.admin_update_customer_crm_v1($1,$2,$3::jsonb,$4::text[]) result",
      ["KH1", actor, JSON.stringify(changes), interests],
    )).rows[0].result;
    let result = await update({ ten_kh: "Ten moi", ngay_sinh: "2000-02-29" }, ["GAMING", "VAN_PHONG"]);
    assert.equal(result.profile.ten_kh, "Ten moi");
    assert.equal(result.profile.ngay_sinh, "2000-02-29");
    assert.equal(result.profile.ngay_tao, null);
    assert.ok(result.profile.cap_nhat_luc);
    assert.deepEqual(result.so_thich, ["GAMING", "VAN_PHONG"]);
    assert.equal(result.account.ma_tk, "TK1");
    assert.ok(!JSON.stringify(result).includes("mat_khau_hash"));
    await assert.rejects(update({ ten_kh: "MUST_NOT_SAVE" }, ["UNKNOWN"]), e => e.code === "23514");
    await assert.rejects(update({ ngay_sinh: "2999-01-01" }, null), e => e.code === "23514");
    await assert.rejects(update({ luu_tru_luc: null }, null), e => e.code === "23514");
    await assert.rejects(update({ ten_kh: " " }, null), e => e.code === "23514");
    await assert.rejects(update({}, ["GAMING", "GAMING"]), e => e.code === "23514");
    await assert.rejects(update({}, [], "TK1"), e => e.code === "42501");
    await assert.rejects(db.query("select public.admin_update_customer_crm_v1('MISSING','AD1','{}',null)"), e => e.code === "P0002");
    result = await update({ sdt: "09001" }, null);
    assert.deepEqual(result.so_thich, ["GAMING", "VAN_PHONG"]);
    assert.equal(result.profile.ten_kh, "Ten moi");
    await db.exec('update public."SO_THICH" set trang_thai=0 where ma_so_thich=\'GAMING\'');
    result = await update({}, ["GAMING"]); // Retaining an existing inactive choice is allowed.
    assert.deepEqual(result.so_thich, ["GAMING"]);
    result = await update({ ngay_sinh: null }, []);
    assert.equal(result.profile.ngay_sinh, null);
    assert.deepEqual(result.so_thich, []);
    await assert.rejects(update({}, ["GAMING"]), e => e.code === "23514"); // Cannot select a new inactive choice.
    await update({}, ["VAN_PHONG"]);

    // Force an error AFTER the customer update and relation delete, proving rollback.
    await db.exec("reset role");
    await db.exec(`create function public.crm_test_reject_link() returns trigger language plpgsql as $$
      begin raise exception 'TEST' using errcode='23514'; end; $$;
      create trigger crm_test_reject_link before insert on public."KHACH_HANG_SO_THICH"
      for each row execute function public.crm_test_reject_link();`);
    await db.exec("set role service_role");
    await assert.rejects(update({ ten_kh: "MUST_ROLL_BACK" }, ["DO_HOA"]), e => e.code === "23514");
    assert.equal((await db.query('select ten_kh from public."KHACH_HANG" where ma_kh=\'KH1\'')).rows[0].ten_kh, "Ten moi");
    assert.equal((await db.query('select ma_so_thich from public."KHACH_HANG_SO_THICH" where ma_kh=\'KH1\'')).rows[0].ma_so_thich, "VAN_PHONG");

    await db.exec("reset role; set role anon");
    await assert.rejects(db.query('select * from public."SO_THICH"'), e => e.code === "42501");
    await assert.rejects(update({}, []), e => e.code === "42501");
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query('select * from public."KHACH_HANG_SO_THICH"'), e => e.code === "42501");
    await assert.rejects(update({}, []), e => e.code === "42501");
    console.log("PASS: initial schema + both CRM migrations, null preservation, timestamps, atomic rollback, validation, inactive interests, actor recheck and role grants in isolated PGlite PostgreSQL.");
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

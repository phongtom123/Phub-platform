/** Isolated PostgreSQL RAM test. Does not read .env or connect to Supabase.
 * Reproduces the deployed database: admin_update_feedback_v1 without the closed-ticket guard,
 * then checks that 20261112100000_crm_closed_ticket_and_conflict_codes.sql restores it. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const sql = name => fs.readFileSync(path.join(root, 'Backend/migrations', name), 'utf8');
const GUARD = "  if v_row.trang_thai = 'DA_DONG' then\n    raise exception 'STATE_CONFLICT' using errcode='23514';\n  end if;\n"
  + "  if p_changes ? 'trang_thai' and p_changes->>'trang_thai' = 'MOI' and v_row.trang_thai in ('DANG_XU_LY', 'DA_GIAI_QUYET') then\n"
  + "    raise exception 'STATE_CONFLICT' using errcode='23514';\n  end if;\n";

async function main() {
  const db = await PGlite.create();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(sql('001_initial_schema.sql'));
    await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh) values ('KH1','Khach 1');
      insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values ('NV1','ADMIN','Admin');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh) values ('TK1','customer','!test','KH1');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('AD1','admin','!test','NV1');`);
    const support = sql('20261023_customer_support.sql');
    assert.ok(support.replace(/\r\n/g, '\n').includes(GUARD), 'Fixture must locate the guard added by f4804e9');
    // State of the running database: the guard never reached it.
    await db.exec(support.replace(/\r\n/g, '\n').replace(GUARD, ''));
    const fixed = '20261112100000_crm_closed_ticket_and_conflict_codes.sql';
    const before = (await db.query(`select pg_get_functiondef('public.admin_update_feedback_v1(text,uuid,jsonb)'::regprocedure) src`)).rows[0].src;
    assert.ok(!before.includes("v_row.trang_thai = 'DA_DONG'"));
    await db.exec(sql(fixed));
    await db.exec(sql(fixed)); // re-running is a no-op
    const after = (await db.query(`select pg_get_functiondef('public.admin_update_feedback_v1(text,uuid,jsonb)'::regprocedure) src`)).rows[0].src;
    assert.equal(after.split("v_row.trang_thai = 'DA_DONG'").length - 1, 1, 'Guard is inserted exactly once');

    await db.exec('set role service_role');
    const item = (await db.query('select public.customer_create_feedback_v1($1,$2::jsonb) item',
      ['TK1', JSON.stringify({ tieu_de: 'Test', noi_dung: 'Noi dung' })])).rows[0].item;
    const update = async changes => (await db.query('select public.admin_update_feedback_v1($1,$2::uuid,$3::jsonb) item',
      ['AD1', item.ma_phan_hoi, JSON.stringify(changes)])).rows[0].item;
    const conflict = e => e.code === '23514' && e.message === 'STATE_CONFLICT';
    let row = await update({ nhan_xu_ly: true, trang_thai: 'DANG_XU_LY' });
    assert.equal(row.trang_thai, 'DANG_XU_LY');
    await assert.rejects(update({ trang_thai: 'MOI' }), conflict, 'In-progress ticket cannot be reset to MOI');
    row = await update({ trang_thai: 'DA_DONG' });
    assert.equal(row.trang_thai, 'DA_DONG');
    await assert.rejects(update({ muc_do_uu_tien: 'THAP' }), conflict, 'Closed ticket priority is read-only');
    await assert.rejects(update({ trang_thai: 'MOI' }), conflict, 'Closed ticket cannot be reopened');
    await assert.rejects(update({ phan_hoi_quan_ly: 'Late reply' }), conflict, 'Closed ticket reply is read-only');
    const stored = (await db.query('select trang_thai,muc_do_uu_tien from public."PHAN_HOI"')).rows[0];
    assert.deepEqual(stored, { trang_thai: 'DA_DONG', muc_do_uu_tien: 'BINH_THUONG' });
    console.log('PASS: closed-ticket guard restored on a database without it; migration is idempotent.');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exit(1); });

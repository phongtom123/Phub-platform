/** Isolated PostgreSQL RAM test. Does not read .env or connect to Supabase. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
async function main() {
  const db = await PGlite.create();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(fs.readFileSync(path.join(root, 'database/migrations/001_initial_schema.sql'), 'utf8'));
    await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh) values ('KH1','Khach 1'),('KH2','Khach 2');
      insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values ('NV1','ADMIN','Admin');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh) values ('TK1','customer','!test','KH1');
      insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values ('AD1','admin','!test','NV1');
      insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,thoi_gian_dat) values ('DH2','KH2','ONLINE',now()),('DH1','KH1','ONLINE',now());`);
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261023_customer_support.sql'), 'utf8'));
    await db.exec('set role service_role');
    const create = async (payload, actor = 'TK1') => (await db.query('select public.customer_create_feedback_v1($1,$2::jsonb) item', [actor, JSON.stringify(payload)])).rows[0].item;
    const item = await create({ tieu_de: '  Test  ', noi_dung: 'Noi dung\nDong hai', ma_donhang: 'DH1' });
    assert.equal(item.ma_kh, 'KH1'); assert.equal(item.tieu_de, 'Test');
    assert.equal(item.trang_thai, 'MOI'); assert.equal(item.muc_do_uu_tien, 'BINH_THUONG');
    await assert.rejects(create({ tieu_de: 'x', noi_dung: 'x', ma_kh: 'KH2' }), e => e.code === '23514');
    await assert.rejects(create({ tieu_de: 'x', noi_dung: 'x', ma_donhang: 'DH2' }), e => e.code === '23514');
    await assert.rejects(create({ tieu_de: 'x', noi_dung: 'x', ma_sp: 'UNKNOWN' }), e => e.code === '23503');
    await assert.rejects(create({ tieu_de: '', noi_dung: 'x' }), e => e.code === '23514');
    await assert.rejects(create({ tieu_de: 'x', noi_dung: 'x' }, 'AD1'), e => e.code === '42501');
    assert.equal((await db.query('select count(*)::int n from public."PHAN_HOI"')).rows[0].n, 1);
    const update = async (changes, actor = 'AD1', id = item.ma_phan_hoi) => (await db.query(
      'select public.admin_update_feedback_v1($1,$2::uuid,$3::jsonb) item', [actor, id, JSON.stringify(changes)])).rows[0].item;
    let changed = await update({ nhan_xu_ly: true, trang_thai: 'DANG_XU_LY', muc_do_uu_tien: 'CAO', phan_hoi_quan_ly: ' Da tiep nhan ' });
    assert.equal(changed.nguoi_xu_ly, 'NV1'); assert.equal(changed.ten_kh, 'Khach 1');
    assert.equal(changed.ten_nguoi_xu_ly, 'Admin'); assert.equal(changed.phan_hoi_quan_ly, 'Da tiep nhan');
    assert.ok(changed.ngay_phan_hoi); assert.equal(changed.trang_thai, 'DANG_XU_LY');
    await assert.rejects(update({ trang_thai: 'NOPE', phan_hoi_quan_ly: 'MUST_ROLLBACK' }), e => e.code === '23514');
    assert.equal((await db.query('select phan_hoi_quan_ly from public."PHAN_HOI"')).rows[0].phan_hoi_quan_ly, 'Da tiep nhan');
    await assert.rejects(update({ ma_kh: 'KH2' }), e => e.code === '23514');
    await assert.rejects(update({ trang_thai: 'DA_DONG' }, 'TK1'), e => e.code === '42501');
    await assert.rejects(update({ trang_thai: 'DA_DONG' }, 'AD1', '11111111-1111-4111-8111-111111111111'), e => e.code === 'P0002');
    changed = await update({ phan_hoi_quan_ly: null, trang_thai: 'DA_DONG' });
    assert.equal(changed.phan_hoi_quan_ly, null); assert.equal(changed.ngay_phan_hoi, null);
    await db.exec('update public."TAI_KHOAN" set trang_thai=2 where ma_tk=\'AD1\'');
    await assert.rejects(update({ trang_thai: 'MOI' }), e => e.code === '42501');
    await db.exec('update public."TAI_KHOAN" set trang_thai=2 where ma_tk=\'TK1\'');
    await assert.rejects(create({ tieu_de: 'x', noi_dung: 'x' }), e => e.code === '42501');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(db.query('select * from public."PHAN_HOI"'), e => e.code === '42501');
      await assert.rejects(create({ tieu_de: 'x', noi_dung: 'x' }), e => e.code === '42501');
      await assert.rejects(update({ trang_thai: 'MOI' }), e => e.code === '42501');
    }
    console.log('PASS: support migration, customer ownership, order/product validation, ADMIN recheck, assignment/reply, rollback, locked accounts and role grants in isolated PostgreSQL.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

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
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/001_initial_schema.sql'), 'utf8'));
    // Existing customers before the migration: complete (phone with separators), name only, incomplete address.
    await db.exec(`insert into public."KHACH_HANG"(ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md,tinh_thanh_md,xa_phuong_md) values
      ('KH1','Khach 1','090 123-4567','1 Duong A','TP HCM','Phuong 1'),
      ('KH2','Khach 2',null,null,null,null),
      ('KH3','Khach 3','0911111111','3 Duong C',null,'Phuong 3'),
      ('KH4','Khach 4','abc','4 Duong D','TP HCM','Phuong 4');`);
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261102090000_customer_address_book.sql'), 'utf8'));
    // Re-running is refused by the preflight (the aborted transaction is rolled back here).
    await assert.rejects(db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261102090000_customer_address_book.sql'), 'utf8')), /Khong chay lai/);
    await db.exec('rollback');

    const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
    const addresses = (ma) => rows('select * from public."DIA_CHI_KHACH_HANG" where ma_kh=$1 order by ngay_tao, ma_dia_chi', [ma]);
    const customer = async (ma) => (await rows('select * from public."KHACH_HANG" where ma_kh=$1', [ma]))[0];

    // Backfill only converts complete, valid profiles and normalizes the phone like the API.
    let kh1 = await addresses('KH1');
    assert.equal(kh1.length, 1); assert.equal(kh1[0].la_mac_dinh, true);
    assert.equal(kh1[0].sdt_nguoi_nhan, '0901234567'); assert.equal(kh1[0].ten_nguoi_nhan, 'Khach 1');
    for (const ma of ['KH2', 'KH3', 'KH4']) assert.equal((await addresses(ma)).length, 0, ma);
    assert.equal((await customer('KH1')).sdt, '090 123-4567', 'KHACH_HANG must be left untouched by the backfill');

    await db.exec('set role service_role');
    const call = async (ma, action, id = null, payload = null) => (await db.query(
      'select public.customer_address_v1($1,$2,$3::uuid,$4::jsonb) r', [ma, action, id, payload === null ? null : JSON.stringify(payload)])).rows[0].r;
    const address = (n, extra = {}) => ({ name: `Nguoi ${n}`, phone: `09000000${String(n).padStart(2, '0')}`, address_line: `${n} Duong X`, province: 'TP HCM', ward: `Phuong ${n}`, ...extra });
    const code = (result) => result.error && result.error.code;

    // list
    let r = await call('KH1', 'list');
    assert.equal(r.items.length, 1); assert.equal(r.item, null); assert.equal(r.items[0].is_default, true);
    assert.deepEqual(Object.keys(r.items[0]).sort(), ['address_line', 'id', 'is_default', 'name', 'phone', 'province', 'ward']);
    assert.equal(code(await call('NOPE', 'list')), 'AUTH_CUSTOMER_UNAVAILABLE');

    // The first address is always the default and is mirrored on KHACH_HANG.
    r = await call('KH2', 'create', null, address(1));
    assert.equal(r.item.is_default, true); assert.equal(r.items.length, 1);
    let kh2 = await customer('KH2');
    assert.equal(kh2.dia_chi_chi_tiet_md, '1 Duong X'); assert.equal(kh2.xa_phuong_md, 'Phuong 1');
    assert.equal(kh2.ten_kh, 'Khach 2', 'recipient name must not rename the account');
    // Touching KHACH_HANG without changing name/phone/address (e.g. CRM updating non-address fields) must not overwrite recipient name/phone.
    await db.query(`update public."KHACH_HANG" set ten_kh = ten_kh, sdt = sdt, dia_chi_chi_tiet_md = dia_chi_chi_tiet_md where ma_kh = 'KH2'`);
    assert.equal((await addresses('KH2'))[0].ten_nguoi_nhan, 'Nguoi 1');
    const first = r.item.id;

    // A second address is not default unless requested.
    r = await call('KH2', 'create', null, address(2));
    assert.equal(r.item.is_default, false); const second = r.item.id;
    assert.equal((await customer('KH2')).dia_chi_chi_tiet_md, '1 Duong X');
    r = await call('KH2', 'create', null, address(3, { is_default: true }));
    const third = r.item.id;
    assert.equal(r.item.is_default, true);
    assert.deepEqual(r.items.map(i => i.is_default), [true, false, false]); assert.equal(r.items[0].id, third);
    assert.equal((await customer('KH2')).dia_chi_chi_tiet_md, '3 Duong X');
    assert.equal((await rows('select count(*)::int n from public."DIA_CHI_KHACH_HANG" where ma_kh=\'KH2\' and la_mac_dinh'))[0].n, 1);

    // Update: make another default; the default cannot be switched off directly.
    r = await call('KH2', 'update', second, address(2, { name: '  Moi  ', phone: '(090) 111-2222', is_default: true }));
    assert.equal(r.item.name, 'Moi'); assert.equal(r.item.phone, '0901112222'); assert.equal(r.item.is_default, true);
    assert.equal(r.items[0].id, second); assert.equal((await customer('KH2')).dia_chi_chi_tiet_md, '2 Duong X');
    r = await call('KH2', 'update', second, address(2, { is_default: false }));
    assert.equal(r.item.is_default, true);
    // Editing a non-default address leaves KHACH_HANG alone.
    await call('KH2', 'update', first, address(1, { address_line: 'Sua dia chi 1' }));
    assert.equal((await customer('KH2')).dia_chi_chi_tiet_md, '2 Duong X');

    // Delete the default: the most recently updated remaining address is promoted and mirrored.
    r = await call('KH2', 'delete', second);
    assert.equal(r.item, null); assert.equal(r.items.length, 2); assert.equal(r.items[0].is_default, true);
    assert.equal(r.items[0].id, first);
    assert.equal((await customer('KH2')).dia_chi_chi_tiet_md, 'Sua dia chi 1');
    await call('KH2', 'delete', third); r = await call('KH2', 'delete', first);
    assert.deepEqual(r.items, []);
    kh2 = await customer('KH2');
    assert.equal(kh2.dia_chi_chi_tiet_md, null); assert.equal(kh2.tinh_thanh_md, null); assert.equal(kh2.xa_phuong_md, null);

    // Limit of 10 addresses per customer.
    for (let n = 1; n <= 10; n++) assert.equal(code(await call('KH3', 'create', null, address(n))), undefined);
    assert.equal(code(await call('KH3', 'create', null, address(11))), 'ADDRESS_LIMIT_REACHED');
    assert.equal((await addresses('KH3')).length, 10);

    // Ownership and validation: nothing is written for rejected requests.
    const other = (await addresses('KH3'))[0].ma_dia_chi;
    assert.equal(code(await call('KH1', 'update', other, address(1))), 'ADDRESS_NOT_FOUND');
    assert.equal(code(await call('KH1', 'delete', other)), 'ADDRESS_NOT_FOUND');
    assert.equal(code(await call('KH1', 'delete', '11111111-1111-4111-8111-111111111111')), 'ADDRESS_NOT_FOUND');
    assert.equal(code(await call('NOPE', 'create', null, address(1))), 'AUTH_CUSTOMER_UNAVAILABLE');
    const bad = [
      { ...address(1), ma_kh: 'KH3' }, { ...address(1), phone: '12ab' }, { ...address(1), phone: '123' },
      { ...address(1), name: '   ' }, { ...address(1), ward: 'Phuong\u0007' }, { ...address(1), address_line: 'x'.repeat(256) },
      { ...address(1), is_default: 'true' }, { ...address(1), province: null }, { name: 'only' },
    ];
    for (const payload of bad) assert.equal(code(await call('KH1', 'create', null, payload)), 'VALIDATION_ERROR', JSON.stringify(payload));
    assert.equal(code(await call('KH1', 'create', null, 'text')), 'VALIDATION_ERROR');
    assert.equal(code(await call('KH1', 'create', null, null)), 'VALIDATION_ERROR');
    assert.equal(code(await call('KH1', 'oops')), 'VALIDATION_ERROR');
    assert.equal((await addresses('KH1')).length, 1);

    // KHACH_HANG -> default address (PUT /me and Admin CRM keep the address book in sync).
    await db.query(`update public."KHACH_HANG" set ten_kh='Khach 1 moi', sdt='0987654321', dia_chi_chi_tiet_md='9 Duong Moi', tinh_thanh_md='Ha Noi', xa_phuong_md='Phuong 9' where ma_kh='KH1'`);
    kh1 = await addresses('KH1');
    assert.equal(kh1.length, 1);
    assert.deepEqual([kh1[0].ten_nguoi_nhan, kh1[0].sdt_nguoi_nhan, kh1[0].dia_chi_chi_tiet, kh1[0].tinh_thanh, kh1[0].xa_phuong, kh1[0].la_mac_dinh],
      ['Khach 1 moi', '0987654321', '9 Duong Moi', 'Ha Noi', 'Phuong 9', true]);
    // Incomplete profile data never wipes or breaks the address book.
    await db.query(`update public."KHACH_HANG" set xa_phuong_md=null where ma_kh='KH1'`);
    assert.equal((await addresses('KH1'))[0].xa_phuong, 'Phuong 9');
    // A profile that becomes complete creates the first (default) address.
    await db.query(`update public."KHACH_HANG" set tinh_thanh_md='TP HCM' where ma_kh='KH3'`);
    assert.equal((await addresses('KH3')).length, 10, 'KH3 already has a default; no extra row');
    await db.query(`update public."KHACH_HANG" set sdt='0900000099', tinh_thanh_md='Da Nang', xa_phuong_md='P4' where ma_kh='KH4'`);
    const kh4 = await addresses('KH4');
    assert.equal(kh4.length, 1); assert.equal(kh4[0].la_mac_dinh, true); assert.equal(kh4[0].tinh_thanh, 'Da Nang');
    await db.query(`insert into public."KHACH_HANG"(ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md,tinh_thanh_md,xa_phuong_md) values ('KH5','Khach 5','0900000055','5 Duong E','Hue','P5')`);
    assert.equal((await addresses('KH5')).length, 1);

    // Orders keep their own snapshot: changing or deleting the address book never alters them.
    await db.query(`insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,thoi_gian_dat,dia_chi_chi_tiet,ghi_chu) values ('DH1','KH1','ONLINE',now(),'Dia chi luc dat','Giao gio hanh chinh')`);
    await call('KH1', 'delete', (await addresses('KH1'))[0].ma_dia_chi);
    const order = (await rows('select dia_chi_chi_tiet, ghi_chu from public."DON_HANG" where ma_donhang=\'DH1\''))[0];
    assert.deepEqual(order, { dia_chi_chi_tiet: 'Dia chi luc dat', ghi_chu: 'Giao gio hanh chinh' });

    // Only service_role may use the table and the RPC.
    await db.exec('reset role');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public."DIA_CHI_KHACH_HANG"'), e => e.code === '42501', role);
      await assert.rejects(db.query(`select public.customer_address_v1('KH1','list')`), e => e.code === '42501', role);
      await db.exec('reset role');
    }
    console.log('customer address book SQL tests passed');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
